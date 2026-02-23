// Lógica de dashboard extraída de app.js

        // ========================================
        // FUNCIONES DEL DASHBOARD
        // ========================================

        let dashboardCharts = {};

        function requireGlobalFunction(functionName) {
            const fn = globalThis[functionName];
            if (typeof fn !== 'function') {
                throw new ReferenceError(`${functionName} no está disponible en window`);
            }
            return fn;
        }

        const supabaseClient = new Proxy({}, {
            get(_target, property) {
                const client = globalThis.supabaseClient;
                if (!client) {
                    throw new ReferenceError('supabaseClient no está disponible en window');
                }

                const value = client[property];
                return typeof value === 'function' ? value.bind(client) : value;
            }
        });

        const validateSession = (...args) => requireGlobalFunction('validateSession')(...args);
        const showError = (...args) => requireGlobalFunction('showError')(...args);
        const logout = (...args) => requireGlobalFunction('logout')(...args);
        const getColombiaDate = (...args) => requireGlobalFunction('getColombiaDate')(...args);
        const logSecurityEvent = (...args) => requireGlobalFunction('logSecurityEvent')(...args);
        const showSuccess = (...args) => requireGlobalFunction('showSuccess')(...args);

        async function loadDashboard() {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                console.log('📊 Iniciando carga del dashboard...');
                
                // Mostrar indicador de carga
                document.getElementById('dashPendingCount').textContent = '...';
                document.getElementById('dashConfirmedCount').textContent = '...';
                document.getElementById('dashTotalCount').textContent = '...';
                document.getElementById('dashRecentCount').textContent = '...';
                
                const todayColombia = getColombiaDate();
                console.log('📅 Fecha Colombia para consulta:', todayColombia);

                const { data: dashboardSummary, error: summaryError } = await supabaseClient
                    .rpc('get_dashboard_salidas_summary', { p_fecha: todayColombia });

                if (summaryError) {
                    console.error('❌ Error en RPC de resumen de dashboard:', summaryError);
                    throw summaryError;
                }

               const summary = Array.isArray(dashboardSummary) && dashboardSummary.length > 0
                    ? dashboardSummary[0]
                    : { pendientes: 0, confirmadas: 0, total: 0, actividad_reciente: 0 };
                    
                const pendingCount = Number(summary.pendientes || 0);
                const confirmedCount = Number(summary.confirmadas || 0);
                const totalCount = Number(summary.total || 0);
                const recentCount = Number(summary.actividad_reciente || 0);

                console.log(`📈 Estadísticas: ${pendingCount} pendientes, ${confirmedCount} confirmadas`);

                // Actualizar estadísticas básicas primero
                document.getElementById('dashPendingCount').textContent = pendingCount;
                document.getElementById('dashConfirmedCount').textContent = confirmedCount;
                document.getElementById('dashTotalCount').textContent = totalCount;
                document.getElementById('dashRecentCount').textContent = recentCount;

                console.log('✅ Estadísticas básicas actualizadas');

                // Iniciar carga de gráficos sin bloquear estadísticas
                const chartsPromise = (async () => {
                    try {
                        console.log('🔍 Verificando disponibilidad de ECharts...');
                        const echartsAvailable = await ensureEChartsLoaded();
                        if (echartsAvailable) {
                            console.log('✅ ECharts disponible, cargando gráficos completos...');
                            await loadDashboardCharts(todayColombia, pendingCount, confirmedCount);
                        } else {
                            console.log('⚠️ ECharts no disponible, usando gráficos simples...');
                            createSimpleCharts();
                            updateSimpleCharts(pendingCount, confirmedCount);
                        }
                    } catch (chartError) {
                        console.error('❌ Error al cargar gráficos:', chartError);
                        createSimpleCharts();
                        updateSimpleCharts(pendingCount, confirmedCount);
                    }
                })();

                // Cargar actividad reciente mientras se procesan los gráficos
                await loadDashboardActivity(todayColombia);
                await chartsPromise;

                console.log('✅ Dashboard completamente cargado');
                
            } catch (error) {
                console.error('❌ Error general en dashboard:', error);
                await logSecurityEvent('error', 'Error al cargar dashboard', { 
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al cargar el dashboard: ' + error.message);
                updateEmptyDashboard();
            }
        }

        function updateEmptyDashboard() {
            // Mostrar ceros en lugar de errores
            document.getElementById('dashPendingCount').textContent = '0';
            document.getElementById('dashConfirmedCount').textContent = '0';
            document.getElementById('dashTotalCount').textContent = '0';
            document.getElementById('dashRecentCount').textContent = '0';

            // Verificar si ECharts está disponible
            if (typeof echarts !== 'undefined') {
                // Crear gráficos vacíos con ECharts
                createStatusChart(0, 0);
                createGradeChart([]);
                createReasonChart([]);
                createTimelineChart([]);
            } else {
                // Usar gráficos simples
                createSimpleCharts();
                updateSimpleCharts(0, 0);
            }
            
            // Mostrar mensaje en actividad reciente
            const container = document.getElementById('recentActivity');
            if (container) {
                container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No hay salidas registradas para hoy</p>';
            }
            
            console.log('📊 Dashboard inicializado con datos vacíos');
        }

        async function loadDashboardCharts(fechaColombia, pendingCount, confirmedCount) {
            try {
                console.log('📊 Cargando datos para gráficos...');
                
                 const [gradeAggRes, reasonAggRes, timelineAggRes] = await Promise.all([
                    supabaseClient.rpc('get_dashboard_salidas_by_grade', { p_fecha: fechaColombia }),
                    supabaseClient.rpc('get_dashboard_salidas_by_reason', { p_fecha: fechaColombia }),
                    supabaseClient.rpc('get_dashboard_salidas_timeline', { p_fecha: fechaColombia })
                ]);             

                if (gradeAggRes.error) throw gradeAggRes.error;
                if (reasonAggRes.error) throw reasonAggRes.error;
                if (timelineAggRes.error) throw timelineAggRes.error;

                createStatusChart(pendingCount, confirmedCount);
                createGradeChart(gradeAggRes.data || []);
                createReasonChart(reasonAggRes.data || []);
                createTimelineChart(timelineAggRes.data || []);

                console.log('✅ Gráficos creados exitosamente');

            } catch (error) {
                console.error('❌ Error cargando datos para gráficos:', error);
                // Crear gráficos básicos en caso de error
                createStatusChart(pendingCount, confirmedCount);
                createGradeChart([]);
                createReasonChart([]);
                createTimelineChart([]);
            }
        }

        async function loadDashboardActivity(fechaColombia) {
            try {
                console.log('📊 Cargando actividad reciente...');

                const { data: activityData, error: activityError } = await supabaseClient
                    .from('autorizaciones_salida')
                    .select('id, estudiante_id, hora_salida, salida_efectiva, fecha_creacion, usuario_autorizador_id, vigilante_id')
                    .eq('fecha_salida', fechaColombia)
                    .eq('autorizada', true)
                    .order('fecha_creacion', { ascending: false })
                    .limit(15);

                if (activityError) {
                    throw activityError;
                }

                const studentIds = [...new Set((activityData || []).map(auth => auth.estudiante_id).filter(Boolean))];
                const userIds = [...new Set((activityData || [])
                    .flatMap(auth => [auth.usuario_autorizador_id, auth.vigilante_id])
                    .filter(Boolean))];

                const [studentsResponse, usersResponse] = await Promise.all([
                    studentIds.length > 0
                        ? supabaseClient
                            .from('estudiantes')
                            .select('id, nombre, apellidos, grado:grados(nombre)')
                            .in('id', studentIds)
                        : Promise.resolve({ data: [], error: null }),
                    userIds.length > 0
                        ? supabaseClient
                            .from('usuarios')
                            .select('id, nombre')
                            .in('id', userIds)
                        : Promise.resolve({ data: [], error: null })
                ]);

                if (studentsResponse.error) {
                    throw studentsResponse.error;
                }

                if (usersResponse.error) {
                    throw usersResponse.error;
                }

                const studentMap = {};
                (studentsResponse.data || []).forEach(student => {
                    studentMap[student.id] = student;
                });

                const userMap = {};
                (usersResponse.data || []).forEach(user => {
                    userMap[user.id] = user;
                });
                    
                const activityMap = {};
                (activityData || []).forEach(activity => {
                    activityMap[activity.id] = {
                        ...activity,
                        estudiante: studentMap[activity.estudiante_id] || null,
                        usuario: userMap[activity.usuario_autorizador_id] || null,
                        vigilante: userMap[activity.vigilante_id] || null
                    };
                });

                 const enrichedForActivity = (activityData || [])
                    .map(auth => activityMap[auth.id] || auth);
                    
                displayRecentActivity(enrichedForActivity);
                console.log('✅ Actividad reciente cargada');

            } catch (error) {
                console.error('❌ Error cargando actividad:', error);
                // Mostrar actividad básica
                displayRecentActivity([]);
            }
        }

        function createStatusChart(pendingCount, confirmedCount) {
            try {
                const el = document.getElementById('statusChart');
                if (!el) {
                    console.error('❌ Elemento statusChart no encontrado');
                    return;
                }
                if (typeof echarts === 'undefined') {
                    console.error('❌ ECharts no está disponible');
                    el.parentElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">ECharts no está cargado</p>';
                    return;
                }
                console.log(`📊 Creando gráfico de estado: ${pendingCount} pendientes, ${confirmedCount} confirmadas`);
                if (dashboardCharts.statusChart) {
                    dashboardCharts.statusChart.dispose();
                }
                const chart = echarts.init(el);
                const hasData = pendingCount !== 0 || confirmedCount !== 0;
                const option = hasData ? {
                    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                    legend: { bottom: 0 },
                    series: [{
                        type: 'pie',
                        radius: ['40%', '70%'],
                        avoidLabelOverlap: false,
                        label: { show: true, formatter: '{b}: {c}' },
                        labelLine: { show: true },
                        data: [
                            { value: pendingCount, name: '🟢 Pendientes' },
                            { value: confirmedCount, name: '🔵 Confirmadas' }
                        ]
                    }]
                } : {
                    tooltip: { show: false },
                    legend: { show: false },
                    series: [{
                        type: 'pie',
                        radius: ['40%', '70%'],
                        label: { show: false },
                        data: [{ value: 1, name: 'Sin datos', itemStyle: { color: '#ecf0f1' } }]
                    }]
                };
                chart.setOption(option);
                dashboardCharts.statusChart = chart;
                console.log('✅ Gráfico de estado creado');
            } catch (error) {
                console.error('❌ Error creando gráfico de estado:', error);
                const el2 = document.getElementById('statusChart');
                if (el2) {
                    el2.parentElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Error cargando gráfico</p>';
                }
            }
        }

        function createGradeChart(gradeAggregation) {
            try {
                const el = document.getElementById('gradeChart');
                if (!el) {
                    console.error('❌ gradeChart no disponible');
                    return;
                }
                if (typeof echarts === 'undefined') {
                    console.error('❌ ECharts no está disponible');
                    el.parentElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">ECharts no está cargado</p>';
                    return;
                }
                if (dashboardCharts.gradeChart) {
                dashboardCharts.gradeChart.dispose();
                }
                const labels = gradeAggregation.map(item => item.grado || 'Sin grado');
                const pendingData = gradeAggregation.map(item => Number(item.pendientes || 0));
                const confirmedData = gradeAggregation.map(item => Number(item.confirmadas || 0));
                const chart = echarts.init(el);
                let option;
                if (labels.length === 0) {
                    option = {
                        xAxis: { type: 'category', data: ['Sin datos'] },
                        yAxis: { type: 'value' },
                        series: [{ type: 'bar', data: [0], itemStyle: { color: '#ecf0f1' } }]
                    };
                } else {
                    option = {
                        tooltip: { trigger: 'axis' },
                        legend: {},
                        xAxis: { type: 'category', data: labels },
                        yAxis: { type: 'value', min: 0 },
                        series: [
                            { name: '🟢 Pendientes', type: 'bar', data: pendingData, itemStyle: { color: '#2ecc71' }, label: { show: true, position: 'top' } },
                            { name: '🔵 Confirmadas', type: 'bar', data: confirmedData, itemStyle: { color: '#3498db' }, label: { show: true, position: 'top' } }
                        ]
                     };
                }
                chart.setOption(option);
                dashboardCharts.gradeChart = chart;
                
                console.log('✅ Gráfico por grados creado');
            } catch (error) {
                const el = document.getElementById('gradeChart');
                if (el) {
                    el.parentElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Error cargando gráfico</p>';
                }
            }
        }

        function createReasonChart(reasonAggregation) {
            try {
                const el = document.getElementById('reasonChart');
                if (!el) {
                    console.error('❌ reasonChart no disponible');
                    return;
                }
                if (typeof echarts === 'undefined') {
                    console.error('❌ ECharts no está disponible');
                    el.parentElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">ECharts no está cargado</p>';
                    return;
                }
                if (dashboardCharts.reasonChart) {
                    dashboardCharts.reasonChart.dispose();
                }
                const labels = reasonAggregation.map(item => item.motivo || 'Sin motivo');
                const data = reasonAggregation.map(item => Number(item.total || 0));
                const colors = ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c'];
                const chart = echarts.init(el);
                const seriesData = labels.map((label, i) => ({
                    value: data[i],
                    name: label,
                    itemStyle: { color: colors[i % colors.length] }
                }));
                let option;
                if (labels.length === 0) {
                    option = {
                        series: [{
                            type: 'pie',
                            data: [{ value: 1, name: 'Sin datos', itemStyle: { color: '#ecf0f1' } }],
                            label: { show: false }
                        }]
                    };
                } else {
                    option = {
                        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                        series: [{
                            type: 'pie',
                            radius: '70%',
                            data: seriesData,
                            label: { show: true, formatter: '{b}: {c}' },
                            labelLine: { show: true }
                        }]
                    };
                }
                chart.setOption(option);
                dashboardCharts.reasonChart = chart;
                
                console.log('✅ Gráfico por motivos creado');
            } catch (error) {
                const el = document.getElementById('reasonChart');
                if (el) {
                    el.parentElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Error cargando gráfico</p>';
                }
            }
        }

        function createTimelineChart(timelineAggregation) {
            try {
                const el = document.getElementById('timelineChart');
                if (!el) {
                    console.error('❌ timelineChart no disponible');
                    return;
                }
                if (typeof echarts === 'undefined') {
                    console.error('❌ ECharts no está disponible');
                    el.parentElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">ECharts no está cargado</p>';
                    return;
                }
                if (dashboardCharts.timelineChart) {
                    dashboardCharts.timelineChart.dispose();
                }
                const hourlyData = {};
                for (let i = 6; i <= 18; i++) {
                    hourlyData[i] = { pending: 0, confirmed: 0 };
                }
                timelineAggregation.forEach(item => {
                    const hour = Number(item.hora || 0);
                    if (hour >= 6 && hour <= 18) {
                        hourlyData[hour].pending = Number(item.pendientes || 0);
                        hourlyData[hour].confirmed = Number(item.confirmadas || 0);
                    }
                });
const labels = Object.keys(hourlyData).map(h => `${h}:00`);
                const pendingData = Object.values(hourlyData).map(d => d.pending);
                const confirmedData = Object.values(hourlyData).map(d => d.confirmed);
                const chart = echarts.init(el);
                const option = {
                    tooltip: { trigger: 'axis' },
                    legend: {},
                    xAxis: { type: 'category', data: labels },
                    yAxis: { type: 'value' },
                    series: [
                        { name: '🟢 Pendientes', type: 'line', data: pendingData, smooth: true, areaStyle: {}, lineStyle: { color: '#2ecc71' }, itemStyle: { color: '#2ecc71' } },
                        { name: '🔵 Confirmadas', type: 'line', data: confirmedData, smooth: true, areaStyle: {}, lineStyle: { color: '#3498db' }, itemStyle: { color: '#3498db' } }
                    ]
                };
                chart.setOption(option);
                dashboardCharts.timelineChart = chart;
                console.log('✅ Timeline creado');
            } catch (error) {
                console.error('❌ Error creando timeline:', error);
                const el = document.getElementById('timelineChart');
                if (el) {
                    el.parentElement.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Error cargando gráfico</p>';
                }
            }
        }

        function displayRecentActivity(authorizations) {
            const container = document.getElementById('recentActivity');
            
            if (!container) {
                console.error('❌ Contenedor recentActivity no encontrado');
                return;
            }
            
            if (!authorizations || authorizations.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No hay actividad reciente en el sistema</p>';
                return;
            }

            console.log(`📋 Mostrando ${authorizations.length} actividades recientes`);

            let html = '';
            authorizations.forEach((auth, index) => {
                try {
                    const isConfirmed = !!auth.salida_efectiva;
                    
                    // Manejar datos faltantes de manera segura
                    const studentName = auth.estudiante ? 
                        `${auth.estudiante.nombre || ''} ${auth.estudiante.apellidos || ''}`.trim() : 
                        'Estudiante no encontrado';
                    
                    const gradeName = auth.estudiante?.grado?.nombre || 'Sin grado';
                    const time = auth.hora_salida ? formatTime(auth.hora_salida) : 'N/A';
                    const authorizedBy = auth.usuario?.nombre || 'Usuario no encontrado';
                    const confirmedBy = auth.vigilante?.nombre || '';
                    
                    // Mostrar hora de creación vs hora de confirmación
                    let activityTime, actionText;
                    
                    if (isConfirmed) {
                        activityTime = auth.salida_efectiva ? formatDateTime(auth.salida_efectiva) : 'N/A';
                        actionText = confirmedBy ? `Confirmada por ${confirmedBy}` : 'Confirmada';
                    } else {
                        activityTime = auth.fecha_creacion ? formatDateTime(auth.fecha_creacion) : 'N/A';
                        actionText = `Autorizada por ${authorizedBy}`;
                    }

                    html += `
                        <div class="student-item ${isConfirmed ? 'confirmed' : 'pending'}">
                            <div class="student-info">
                                <div class="student-name">${sanitizeHtml(studentName)}</div>
                                <div class="student-details">
                                    ${sanitizeHtml(gradeName)} • Hora salida: ${time}<br>
                                    <small>${sanitizeHtml(actionText)} • ${activityTime}</small>
                                </div>
                            </div>
                            <span class="status-badge ${isConfirmed ? 'status-confirmed' : 'status-pending'}">
                                ${isConfirmed ? '🔵 Confirmada' : '🟢 Pendiente'}
                            </span>
                        </div>
                    `;
                } catch (error) {
                    console.error(`❌ Error procesando actividad ${index}:`, error, auth);
                    // Continuar con el siguiente elemento en lugar de fallar completamente
                }
            });

            container.innerHTML = html || '<p style="text-align: center; color: #666; padding: 20px;">Error al mostrar actividades</p>';
        }

        // ========================================
        // FUNCIONES ESPECÍFICAS PARA VIGILANCIA
        // ========================================

        function showMyConfirmedExits() {
            // Alternar visibilidad de las secciones
            const myConfirmedSection = document.getElementById('myConfirmedSection');
            const pendingSection = document.getElementById('pendingExitsSection');
            const searchSection = document.getElementById('searchSection');
            
            if (myConfirmedSection.style.display === 'none') {
                myConfirmedSection.style.display = 'block';
                pendingSection.style.display = 'none';
                searchSection.style.display = 'none';
                loadMyConfirmedExits();
            } else {
                myConfirmedSection.style.display = 'none';
                pendingSection.style.display = 'block';
                loadPendingExits();
            }
        }

        async function loadMyConfirmedExits() {
            const confirmedList = document.getElementById('myConfirmedList');
                
            try {
                if (!currentUser?.id) {
                    console.error('❌ Usuario no autenticado para cargar confirmaciones');
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                confirmedList.innerHTML = '<div class="card" style="text-align: center; padding: 20px;"><p style="color: #666;">🔄 Cargando mis confirmaciones...</p></div>';
                    
                const todayColombia = getColombiaDate();
                console.log(`📋 Cargando salidas confirmadas por ${currentUser.nombre} para Colombia:`, todayColombia);

                const [studentResponse, staffExitResponse, staffReturnResponse] = await Promise.all([
                    supabaseClient
                        .from('autorizaciones_salida')
                        .select(`
                            *,
                            estudiante:estudiantes(id, nombre, apellidos, grado:grados(nombre), foto_url),
                            motivo:motivos(id, nombre),
                            usuario:usuarios!autorizaciones_salida_usuario_autorizador_id_fkey(id, nombre, email),
                            usuario_modifico:usuarios!autorizaciones_salida_usuario_modifico_id_fkey(id, nombre)
                        `)
                        .eq('fecha_salida', todayColombia)
                        .eq('vigilante_id', currentUser.id)
                        .not('salida_efectiva', 'is', null)
                        .order('salida_efectiva', { ascending: false }),
                    supabaseClient
                        .from('autorizaciones_personal')
                        .select(`
                            *,
                            colaborador:personal_colegio(id, nombre, cargo, cedula),
                            motivo:motivos(id, nombre),
                            usuario:usuarios!autorizaciones_personal_usuario_autorizador_id_fkey(id, nombre, email)
                        `)
                        .eq('fecha_salida', todayColombia)
                        .eq('vigilante_id', currentUser.id)
                        .not('salida_efectiva', 'is', null)
                        .order('salida_efectiva', { ascending: false }),
                    supabaseClient
                        .from('autorizaciones_personal')
                        .select(`
                            *,
                            colaborador:personal_colegio(id, nombre, cargo, cedula),
                            motivo:motivos(id, nombre),
                            usuario:usuarios!autorizaciones_personal_usuario_autorizador_id_fkey(id, nombre, email)
                        `)
                        .eq('fecha_salida', todayColombia)
                        .eq('vigilante_regreso_id', currentUser.id)
                        .not('regreso_efectivo', 'is', null)
                        .order('regreso_efectivo', { ascending: false })
                ]);

                if (studentResponse.error) throw studentResponse.error;
                if (staffExitResponse.error) throw staffExitResponse.error;
                if (staffReturnResponse.error) throw staffReturnResponse.error;

                const myConfirmations = studentResponse.data || [];
                const myStaffExitConfirmations = staffExitResponse.data || [];
                const myStaffReturnConfirmations = staffReturnResponse.data || [];
                const totalRecords = myConfirmations.length + myStaffExitConfirmations.length + myStaffReturnConfirmations.length;
                    
                if (totalRecords === 0) {
                    const currentTime = getColombiaTime();
                    confirmedList.innerHTML = `
                        <div class="verification-card" style="background: linear-gradient(135deg, #95a5a6, #7f8c8d);">
                            <h3>📋 Sin confirmaciones aún</h3>
                            <p><strong>No has confirmado salidas hoy</strong></p>
                            <p>Fecha: ${formatDate(todayColombia)} - Hora: ${currentTime}</p>
                            <p>Las salidas que confirmes aparecerán aquí</p>
                        </div>
                    `;
                    return;
                }

                console.log('📊 Confirmaciones encontradas:', {
                    estudiantes: myConfirmations.length,
                    personal: myStaffExitConfirmations.length,
                    regresos: myStaffReturnConfirmations.length
                });

                const currentTime = getColombiaTime();
                let html = `<div style="text-align: center; margin-bottom: 25px; background: rgba(52, 152, 219, 0.1); padding: 20px; border-radius: 10px;">
                    <p style="color: #2c3e50; font-weight: bold; font-size: 16px;">📅 ${formatDate(todayColombia)} - 🕐 ${currentTime} (Hora Colombia)</p>
                    <p style="color: #7f8c8d; margin-top: 8px;">Salidas confirmadas por mí: <strong>${totalRecords}</strong> (Estudiantes: ${myConfirmations.length} • Personal: ${myStaffExitConfirmations.length} • Regresos: ${myStaffReturnConfirmations.length})</p>
                </div>`;
                    
                myConfirmations.forEach(auth => {
                    const student = auth.estudiante;
                    const reason = auth.motivo;
                    const user = auth.usuario;
                    const modifier = auth.usuario_modifico || null;
                    const modificationDate = auth.ultima_modificacion ? sanitizeHtml(formatDateTime(auth.ultima_modificacion)) : '';
                    const modificationHtml = auth.detalle_modificaciones ? `
                        <div class="verification-card-update">
                            <strong>🔄 Cambios recientes${modifier ? ` por ${sanitizeHtml(modifier.nombre)}` : ''}</strong>
                            <span class="change-details">${sanitizeHtml(auth.detalle_modificaciones)}</span>
                            ${modificationDate ? `<small>Actualizado el ${modificationDate}</small>` : ''}
                        </div>
                    ` : '';

                    html += `
                        <div class="verification-card verified">
                            <h3>✅ SALIDA DE ESTUDIANTE CONFIRMADA</h3>
                            <div class="verification-card-content">
                                <div class="verification-card-info">
                                    <p><strong>👨‍🎓 Estudiante:</strong> <span class="info-value">${student ? sanitizeHtml(`${student.nombre} ${student.apellidos}`) : 'No encontrado'}</span></p>
                                    <p><strong>🎓 Grado:</strong> <span class="info-value">${student?.grado?.nombre ? sanitizeHtml(student.grado.nombre) : 'No encontrado'}</span></p>
                                </div>
                                <div class="verification-card-info">
                                    <p><strong>📝 Motivo de Salida:</strong> <span class="info-value">${reason?.nombre ? sanitizeHtml(reason.nombre) : 'No encontrado'}</span></p>
                                    <p><strong>🕐 Hora Autorizada:</strong> <span class="info-value">${formatTime(auth.hora_salida)}</span></p>
                                </div>
                            </div>
                            <div class="verification-card-footer">
                                <p><strong>✅ Autorizado por:</strong> ${user?.nombre ? sanitizeHtml(user.nombre) : 'No encontrado'}</p>
                                ${auth.observaciones ? `<div class="verification-card-obs"><strong>📝 Observaciones:</strong><br>${sanitizeHtml(auth.observaciones)}</div>` : ''}
                                ${modificationHtml}
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-top: 15px;">
                                    <p style="color: white; font-weight: bold; margin: 0;">
                                        ✅ CONFIRMADA: ${formatDateTime(auth.salida_efectiva)}<br>
                                        <small>Confirmada por: ${sanitizeHtml(currentUser.nombre)}</small>
                                    </p>
                                </div>
                                
                            </div>
                    `;
                });

                myStaffExitConfirmations.forEach(auth => {
                    const staff = auth.colaborador;
                    const reason = auth.motivo;
                    const user = auth.usuario;

                    html += `
                        <div class="verification-card verified">
                            <h3>✅ SALIDA DE PERSONAL CONFIRMADA</h3>
                            <div class="verification-card-content">
                                <div class="verification-card-info">
                                    <p><strong>👥 Colaborador:</strong> <span class="info-value">${staff ? sanitizeHtml(staff.nombre) : 'No encontrado'}</span></p>
                                    <p><strong>💼 Cargo:</strong> <span class="info-value">${staff?.cargo ? sanitizeHtml(staff.cargo) : 'No registrado'}</span></p>
                                </div>
                                <div class="verification-card-info">
                                    <p><strong>🧾 Cédula:</strong> <span class="info-value">${staff?.cedula ? sanitizeHtml(staff.cedula) : 'N/A'}</span></p>
                                    <p><strong>🕐 Hora Autorizada:</strong> <span class="info-value">${formatTime(auth.hora_salida)}</span></p>
                                </div>
                            </div>
                            <div class="verification-card-footer">
                                <p><strong>✅ Autorizado por:</strong> ${user?.nombre ? sanitizeHtml(user.nombre) : 'No encontrado'}</p>
                                ${reason?.nombre ? `<p><strong>📝 Motivo:</strong> ${sanitizeHtml(reason.nombre)}</p>` : ''}
                                ${auth.observaciones ? `<div class="verification-card-obs"><strong>📝 Observaciones:</strong><br>${sanitizeHtml(auth.observaciones)}</div>` : ''}
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-top: 15px;">
                                    <p style="color: white; font-weight: bold; margin: 0;">
                                        ✅ CONFIRMADA: ${formatDateTime(auth.salida_efectiva)}<br>
                                        <small>Confirmada por: ${sanitizeHtml(currentUser.nombre)}</small>
                                    </p>
                                </div>
                            </div>
                        </div>
                    `;
                });

                myStaffReturnConfirmations.forEach(auth => {
                    const staff = auth.colaborador;
                    const reason = auth.motivo;
                    const user = auth.usuario;

                    html += `
                        <div class="verification-card verified">
                            <h3>✅ REGRESO DE PERSONAL REGISTRADO</h3>
                            <div class="verification-card-content">
                                <div class="verification-card-info">
                                    <p><strong>👥 Colaborador:</strong> <span class="info-value">${staff ? sanitizeHtml(staff.nombre) : 'No encontrado'}</span></p>
                                    <p><strong>💼 Cargo:</strong> <span class="info-value">${staff?.cargo ? sanitizeHtml(staff.cargo) : 'No registrado'}</span></p>
                                </div>
                                <div class="verification-card-info">
                                    <p><strong>🧾 Cédula:</strong> <span class="info-value">${staff?.cedula ? sanitizeHtml(staff.cedula) : 'N/A'}</span></p>
                                    <p><strong>🕐 Hora de salida:</strong> <span class="info-value">${auth.salida_efectiva ? formatDateTime(auth.salida_efectiva) : formatTime(auth.hora_salida)}</span></p>
                                    <p><strong>🔁 Regreso registrado:</strong> <span class="info-value">${auth.regreso_efectivo ? formatDateTime(auth.regreso_efectivo) : 'No registrado'}</span></p>
                                </div>
                            </div>
                            <div class="verification-card-footer">
                                <p><strong>✅ Autorizado por:</strong> ${user?.nombre ? sanitizeHtml(user.nombre) : 'No encontrado'}</p>
                                ${reason?.nombre ? `<p><strong>📝 Motivo:</strong> ${sanitizeHtml(reason.nombre)}</p>` : ''}
                                ${auth.observaciones ? `<div class="verification-card-obs"><strong>📝 Observaciones:</strong><br>${sanitizeHtml(auth.observaciones)}</div>` : ''}
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-top: 15px;">
                                    <p style="color: white; font-weight: bold; margin: 0;">
                                        🔁 REGRESO CONFIRMADO<br>
                                        <small>Registrado por: ${sanitizeHtml(currentUser.nombre)}</small>
                                    </p>
                                </div>
                            </div>
                        </div>
                    `;
                });
                    
                confirmedList.innerHTML = html;
                console.log('✅ Mis confirmaciones cargadas exitosamente');

            } catch (error) {
                console.error('❌ Error general:', error);
                await logSecurityEvent('error', 'Error al cargar confirmaciones del vigilante', {
                    vigilanteId: currentUser.id,
                    error: error.message.substring(0, 200)
                }, false);
                confirmedList.innerHTML = `
                    <div class="verification-card not-authorized">
                        <h3>❌ Error al cargar</h3>
                        <p>No se pudieron cargar mis confirmaciones</p>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <button class="btn btn-secondary" onclick="loadMyConfirmedExits()" style="margin-top: 10px;">
                            🔄 Intentar de nuevo
                        </button>
                    </div>
                `;
            }
        }

        async function refreshDashboard() {
            try {
                console.log('🔄 Iniciando actualización manual del dashboard...');
                showSuccess('Actualizando dashboard...');
                
                // Limpiar datos actuales
                document.getElementById('dashPendingCount').textContent = '...';
                document.getElementById('dashConfirmedCount').textContent = '...';
                document.getElementById('dashTotalCount').textContent = '...';
                document.getElementById('dashRecentCount').textContent = '...';
                
                // Recargar dashboard
                await loadDashboard();
                
                const currentTime = getColombiaTime();
                showSuccess(`✅ Dashboard actualizado exitosamente a las ${currentTime}`);
                console.log('✅ Actualización manual completada');
                
            } catch (error) {
                console.error('❌ Error en actualización manual:', error);
                showError('Error al actualizar el dashboard: ' + error.message);
            }
        }

        // Función de debug mejorada para verificar datos
        async function debugDashboard() {
            try {
                console.log('🔧 === DEBUG DASHBOARD COMPLETO ===');
                const todayColombia = getColombiaDate();
                console.log('📅 Fecha Colombia:', todayColombia);
                
                // 1. Verificar dependencias críticas
                console.log('📊 === VERIFICACIÓN DE DEPENDENCIAS ===');
                console.log('ECharts disponible:', typeof echarts !== 'undefined');
                if (typeof echarts !== 'undefined') {
                    console.log('ECharts versión:', echarts.version || 'Versión no disponible');
                } else {
                    console.error('❌ ECharts NO ESTÁ CARGADO');

                    // Intentar cargar ECharts ahora
                    console.log('🔄 Intentando cargar ECharts...');
                    try {
                        const loaded = await ensureEChartsLoaded();
                        console.log('ECharts carga forzada:', loaded ? 'ÉXITO' : 'FALLÓ');
                    } catch (error) {
                        console.error('❌ Error cargando ECharts:', error.message);
                    }
                }
                
                console.log('Supabase disponible:', typeof supabaseClient !== 'undefined');
                console.log('CryptoJS disponible:', typeof CryptoJS !== 'undefined');
                
                // 2. Verificar elementos del DOM
                console.log('📊 === VERIFICACIÓN DE ELEMENTOS DOM ===');
                const elements = [
                    'statusChart', 'gradeChart', 'reasonChart', 'timelineChart', 'recentActivity',
                    'dashPendingCount', 'dashConfirmedCount', 'dashTotalCount', 'dashRecentCount'
                ];
                elements.forEach(id => {
                    const element = document.getElementById(id);
                    console.log(`🎯 Elemento ${id}:`, element ? 'ENCONTRADO' : '❌ NO ENCONTRADO');
                    if (element && id.includes('Chart')) {
                        console.log(`   Canvas ${id} dimensiones:`, element.offsetWidth, 'x', element.offsetHeight);
                    }
                });
                
                // 3. Probar consulta de base de datos
                console.log('📊 === VERIFICACIÓN DE BASE DE DATOS ===');
                
                try {
                    const { data, error } = await supabaseClient
                        .from('autorizaciones_salida')
                        .select('*')
                        .eq('fecha_salida', todayColombia);
                        
                    console.log('📊 Consulta básica autorizaciones:', {
                        error: error ? error.message : 'Sin error',
                        count: data ? data.length : 0,
                        sample: data && data.length > 0 ? data[0] : 'No hay datos'
                    });
                    
                    if (data && data.length > 0) {
                        const pending = data.filter(auth => !auth.salida_efectiva);
                        const confirmed = data.filter(auth => auth.salida_efectiva);
                        console.log('📈 Estadísticas calculadas:', {
                            total: data.length,
                            pendientes: pending.length,
                            confirmadas: confirmed.length
                        });
                    }
                    
                } catch (dbError) {
                    console.error('❌ Error en consulta de base de datos:', dbError);
                }
                
                // 4. Verificar tablas relacionadas
                console.log('📊 === VERIFICACIÓN DE TABLAS RELACIONADAS ===');
                try {
                    const [estudiantes, motivos, usuarios] = await Promise.all([
                        supabaseClient.from('estudiantes').select('*').limit(1),
                        supabaseClient.from('motivos').select('*').limit(1),
                        supabaseClient.from('usuarios').select('*').limit(1)
                    ]);
                    
                    console.log('📊 Tablas relacionadas:', {
                        estudiantes: estudiantes.data ? `${estudiantes.data.length} encontrados` : `Error: ${estudiantes.error?.message}`,
                        motivos: motivos.data ? `${motivos.data.length} encontrados` : `Error: ${motivos.error?.message}`,
                        usuarios: usuarios.data ? `${usuarios.data.length} encontrados` : `Error: ${usuarios.error?.message}`
                    });
                } catch (tablesError) {
                    console.error('❌ Error verificando tablas relacionadas:', tablesError);
                }
                
                // 5. Verificar estado actual del dashboard
                console.log('📊 === ESTADO ACTUAL DEL DASHBOARD ===');
                const currentStats = {
                    pendientes: document.getElementById('dashPendingCount')?.textContent || 'N/A',
                    confirmadas: document.getElementById('dashConfirmedCount')?.textContent || 'N/A',
                    total: document.getElementById('dashTotalCount')?.textContent || 'N/A',
                    recientes: document.getElementById('dashRecentCount')?.textContent || 'N/A'
                };
                console.log('📊 Estadísticas mostradas:', currentStats);
                
                // 6. Verificar gráficos existentes
                console.log('📊 === ESTADO DE GRÁFICOS ===');
                console.log('Gráficos en dashboardCharts:', Object.keys(dashboardCharts || {}));
                
                // 7. Intentar crear un gráfico de prueba
               if (typeof echarts !== 'undefined') {
                    console.log('🧪 === PRUEBA DE CREACIÓN DE GRÁFICO ===');
                    try {
                        const testDiv = document.createElement('div');
                        testDiv.style.width = '100px';
                        testDiv.style.height = '100px';
                        const testChart = echarts.init(testDiv);
                        testChart.setOption({
                            series: [{ type: 'pie', data: [{ value: 1, name: 'Prueba' }] }]
                        });
                        console.log('✅ Gráfico de prueba creado exitosamente');
                        testChart.dispose();
                    } catch (chartError) {
                        console.error('❌ Error creando gráfico de prueba:', chartError);
                    }
                }
                
                console.log('🔧 === FIN DEBUG COMPLETO ===');
                
                // Mostrar resumen en la UI
                showSuccess('Debug completado. Revisa la consola del navegador para detalles completos.');
                
            } catch (error) {
                console.error('❌ Error en debug completo:', error);
                showError('Error en debug: ' + error.message);
            }
        }

        async function exportDashboardData() {
            try {
                const todayColombia = getColombiaDate();
                
                const { data: authorizations, error } = await supabaseClient
                    .from('autorizaciones_salida')
                    .select(`
                        *,
                        estudiante:estudiantes(nombre, apellidos, documento, grado:grados(nombre)),
                        motivo:motivos(nombre),
                        usuario:usuarios(nombre),
                        vigilante:usuarios!autorizaciones_salida_vigilante_id_fkey(nombre)
                    `)
                    .eq('fecha_salida', todayColombia);

                if (error) throw error;

                // Crear CSV con información completa
                const csvContent = generateCSVFromData(authorizations);
                downloadCSV(csvContent, `dashboard_salidas_general_${todayColombia}.csv`);
                
                await logSecurityEvent('export', 'Exportación de datos del dashboard', { 
                    fecha: todayColombia,
                    registros: authorizations.length 
                }, true);
                
                showSuccess(`Datos exportados exitosamente: ${authorizations.length} registros`);
                
            } catch (error) {
                console.error('Error exportando datos:', error);
                await logSecurityEvent('error', 'Error al exportar datos del dashboard', { 
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al exportar datos: ' + error.message);
            }
        }

        function generateCSVFromData(data) {
            const headers = [
                'Estudiante', 
                'Documento', 
                'Grado', 
                'Motivo', 
                'Fecha Salida', 
                'Hora Salida', 
                'Estado', 
                'Autorizado Por', 
                'Fecha Autorización',
                'Confirmado Por',
                'Fecha Confirmación',
                'Observaciones'
            ];
            
            const rows = data.map(auth => [
                auth.estudiante ? `${auth.estudiante.nombre} ${auth.estudiante.apellidos}` : '',
                auth.estudiante?.documento || '',
                auth.estudiante?.grado?.nombre || '',
                auth.motivo?.nombre || '',
                auth.fecha_salida,
                auth.hora_salida,
                auth.salida_efectiva ? 'Confirmada' : 'Pendiente',
                auth.usuario?.nombre || '',
                auth.fecha_creacion,
                auth.vigilante?.nombre || '',
                auth.salida_efectiva || '',
                auth.observaciones || ''
            ]);

            return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
        }

        function generateCSVFromLogs(logs, usersById = {}) {
            const headers = [
                'Fecha/Hora',
                'Usuario',
                'Tipo',
                'Acción',
                'Detalles',
                'IP'
            ];

            const rows = logs.map(log => {
                let details = {};
                try {
                    details = log.detalles ? JSON.parse(log.detalles) : {};
                } catch (e) {
                    details = { error: 'Error al parsear detalles' };
                }
                const user = log.usuario || usersById[log.usuario_id];

                return [
                    formatDateTime(log.timestamp),
                    user ? user.nombre : 'Sistema',
                    log.tipo,
                    log.accion,
                    JSON.stringify(details),
                    log.ip_address || 'N/A'
                ];
            });

            return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
        }

        function downloadCSV(content, filename) {
            const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
const runDashboardDiagnostics = debugDashboard;
const forceLoadECharts = forceReloadCharts;

        function showDetailedView() {
    window.open('diagnostico.html', '_blank');
}

function mostrarReporteMensual() {
    const month = document.getElementById('mesReporte')?.value;
    const url = month ? `reporte.html?mes=${encodeURIComponent(month)}` : 'reporte.html';
    window.open(url, '_blank');
}

function mostrarReporteLlegadas() {
    window.open('reporte_llegadas.html', '_blank');
}

function abrirReporte() {
    window.open('reporte.html', '_blank');
}

        function abrirReportePersonal() {
    window.open('reporte_personal.html', '_blank');
}

function abrirReporteVisitantes() {
    window.open('reporte_visitantes.html', '_blank');
}
        async function forceReloadCharts() {
            try {
                console.log('🔄 Forzando recarga de gráficos...');
                showSuccess('Intentando recargar ECharts...');
                
                // Mostrar estado
                const statusDiv = document.getElementById('echartsStatus');
                const statusText = document.getElementById('echartsStatusText');
                
                if (statusDiv && statusText) {
                    statusDiv.style.display = 'block';
                    statusText.textContent = 'Recargando ECharts...';
                }
                
                // Intentar cargar ECharts de nuevo
                const loaded = await ensureEChartsLoaded();
                
                if (loaded) {
                    console.log('✅ ECharts recargado exitosamente');
                    if (statusText) {
                        statusText.textContent = 'ECharts cargado ✅';
                        statusText.style.color = '#2ecc71';
                    }
                    
                    showSuccess('ECharts cargado exitosamente. Actualizando dashboard...');
                    
                    // Recargar dashboard con gráficos
                    setTimeout(async () => {
                        await loadDashboard();
                        showSuccess('Dashboard actualizado con gráficos completos');
                    }, 500);

                } else {
                    console.error('❌ No se pudo cargar ECharts');
                    if (statusText) {
                        statusText.textContent = 'ECharts no disponible ❌';
                        statusText.style.color = '#e74c3c';
                    }
                    showError('No se pudo cargar ECharts. El dashboard funcionará en modo simplificado.');
                }

            } catch (error) {
                console.error('❌ Error forzando recarga de gráficos:', error);
                showError('Error al recargar gráficos: ' + error.message);
                
                const statusText = document.getElementById('echartsStatusText');
                if (statusText) {
                    statusText.textContent = 'Error cargando ECharts ❌';
                    statusText.style.color = '#e74c3c';
                }
            }
        }

        function updateEChartsStatus() {
            const statusDiv = document.getElementById('echartsStatus');
            const statusText = document.getElementById('echartsStatusText');
            
            if (!statusDiv || !statusText) return;

            statusDiv.style.display = 'block';
            
            if (typeof echarts !== 'undefined') {
                statusText.textContent = `ECharts ${echarts.version || 'cargado'} ✅`;
                statusText.style.color = '#2ecc71';
            } else {
                statusText.textContent = 'ECharts no disponible ❌';
                statusText.style.color = '#e74c3c';
            }
        }

        // ========================================

window.dashboardCharts = dashboardCharts;

const dashboardApi = {
    loadDashboard,
    updateEmptyDashboard,
    createStatusChart,
    createGradeChart,
    createReasonChart,
    createTimelineChart,
    displayRecentActivity,
    showMyConfirmedExits,
    refreshDashboard,
    runDashboardDiagnostics,
    debugDashboard,
    exportDashboardData,
    generateCSVFromData,
    generateCSVFromLogs,
    downloadCSV,
    showDetailedView,
    mostrarReporteMensual,
    mostrarReporteLlegadas,
    abrirReporte,
    abrirReportePersonal,
    abrirReporteVisitantes,
    forceLoadECharts,
    updateEChartsStatus
};

Object.assign(window, dashboardApi);
window.dashboardModule = dashboardApi;

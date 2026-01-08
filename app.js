        // ========================================
        // VERIFICACIÓN Y CARGA DE ECHARTS
        // ========================================

        function ensureEChartsLoaded() {
            if (typeof echarts !== 'undefined') {
                console.log('✅ ECharts disponible:', echarts.version);
                return Promise.resolve(true);
            }

            console.error('❌ ECharts no está disponible');
            return Promise.resolve(false);
        }

        // ========================================
        // VERIFICACIÓN Y CARGA DE CRYPTOJS
        // ========================================

         // Verificación simple de CryptoJS
        function ensureCryptoJSLoaded() {
            if (typeof CryptoJS === 'undefined') {
                console.error('❌ CryptoJS no se cargó correctamente');
                return false;
            }

            return true;
        }
    
        // Crear gráficos simples sin ECharts como última opción
        function createSimpleCharts() {
            console.log('📊 Creando gráficos simples sin ECharts...');
            
            // Gráfico de estado simple
            const statusChart = document.getElementById('statusChart');
            if (statusChart) {
                statusChart.parentElement.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <h4>Estado de Salidas</h4>
                        <div style="display: flex; justify-content: space-around; margin: 20px 0;">
                            <div style="background: #2ecc71; color: white; padding: 15px; border-radius: 10px; flex: 1; margin: 0 5px;">
                                <div style="font-size: 24px; font-weight: bold;" id="simple-pending">0</div>
                                <div>🟢 Pendientes</div>
                            </div>
                            <div style="background: #3498db; color: white; padding: 15px; border-radius: 10px; flex: 1; margin: 0 5px;">
                                <div style="font-size: 24px; font-weight: bold;" id="simple-confirmed">0</div>
                                <div>🔵 Confirmadas</div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Otros gráficos simples
            ['gradeChart', 'reasonChart', 'timelineChart'].forEach(chartId => {
                const chart = document.getElementById(chartId);
                if (chart) {
                    chart.parentElement.innerHTML = `
                        <div style="padding: 20px; text-align: center; color: #666;">
                            <p>📊 Gráfico no disponible</p>
                            <p><small>ECharts no se pudo cargar. Los datos básicos están disponibles arriba.</small></p>
                        </div>
                    `;
                }
            });
        }

        function updateSimpleCharts(pendingCount, confirmedCount) {
            const simplePending = document.getElementById('simple-pending');
            const simpleConfirmed = document.getElementById('simple-confirmed');
            
            if (simplePending) simplePending.textContent = pendingCount;
            if (simpleConfirmed) simpleConfirmed.textContent = confirmedCount;
        }

        // Detectar tipo de dispositivo y ajustar UI
        function detectDeviceAndAdjustUI() {
            const isMobile = window.innerWidth <= 480;
            const isTablet = window.innerWidth > 480 && window.innerWidth <= 768;
            const isDesktop = window.innerWidth > 768;
            
            // Ajustar tabla en móvil
            if (isMobile) {
                adjustTablesForMobile();
                adjustModalsForMobile();
                adjustCardsForMobile();
            }
            
            // Ajustar navegación según el dispositivo
            adjustNavigationForDevice();
            
            // Ajustar captcha según el tamaño
            adjustCaptchaSize();
        }

        function adjustTablesForMobile() {
            const tables = document.querySelectorAll('.table');
            tables.forEach(table => {
                // Configurar scroll para la nueva estructura
                const wrapper = table.closest('.table-wrapper');
                if (wrapper) {
                    updateScrollIndicators(wrapper);
                }
            });
        }

        function adjustModalsForMobile() {
            const modals = document.querySelectorAll('.modal-content');
            const isMobile = window.innerWidth <= 480;
            
            modals.forEach(modal => {
                if (isMobile) {
                    modal.style.margin = '2% auto';
                    modal.style.width = '95%';
                    modal.style.maxHeight = '95vh';
                } else {
                    modal.style.margin = '5% auto';
                    modal.style.width = '90%';
                    modal.style.maxHeight = '90vh';
                }
            });
        }

        function adjustCardsForMobile() {
            const cards = document.querySelectorAll('.verification-card');
            const isMobile = window.innerWidth <= 480;
            
            cards.forEach(card => {
                const content = card.querySelector('.verification-card-content');
                if (content) {
                    if (isMobile) {
                        content.style.gridTemplateColumns = '1fr';
                        content.style.gap = '15px';
                    } else {
                        content.style.gridTemplateColumns = '1fr 1fr';
                        content.style.gap = '20px';
                    }
                }
            });
        }

        function adjustNavigationForDevice() {
            const navButtons = document.getElementById('navButtons');
            if (!navButtons) return;
            
            const isMobile = window.innerWidth <= 480;
            
            if (isMobile) {
                navButtons.style.flexDirection = 'column';
                navButtons.style.gap = '10px';
                
                // Hacer botones de navegación más grandes en móvil
                const buttons = navButtons.querySelectorAll('.btn');
                buttons.forEach(btn => {
                    btn.style.width = '100%';
                    btn.style.padding = '12px';
                    btn.style.fontSize = '14px';
                });
            } else {
                navButtons.style.flexDirection = 'row';
                navButtons.style.gap = '15px';
                
                const buttons = navButtons.querySelectorAll('.btn');
                buttons.forEach(btn => {
                    btn.style.width = 'auto';
                    btn.style.padding = '12px 24px';
                    btn.style.fontSize = '16px';
                });
            }
        }

        function adjustCaptchaSize() {
            const captchaContainer = document.querySelector('.captcha-container');
            if (!captchaContainer) return;
            
            const isMobile = window.innerWidth <= 480;
            
            if (isMobile) {
                captchaContainer.style.transform = 'scale(0.9)';
                captchaContainer.style.transformOrigin = 'center';
            } else {
                captchaContainer.style.transform = 'scale(1)';
            }
        }

        // ========================================
        // FUNCIONES DEL DASHBOARD
        // ========================================

        let dashboardCharts = {};

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
                
                // Consulta simplificada - solo datos básicos primero
                const { data: todayAuthorizations, error: authError } = await supabaseClient
                    .from('autorizaciones_salida')
                    .select('id, estudiante_id, motivo_id, hora_salida, salida_efectiva, fecha_creacion, usuario_autorizador_id, vigilante_id')
                    .eq('fecha_salida', todayColombia)
                    .eq('autorizada', true)
                    .order('fecha_creacion', { ascending: false });

                if (authError) {
                    console.error('❌ Error en consulta de autorizaciones:', authError);
                    throw authError;
                }

                const authorizations = todayAuthorizations || [];
                console.log(`📊 Autorizaciones encontradas: ${authorizations.length}`);

                // Procesar estadísticas básicas
                const pending = authorizations.filter(auth => !auth.salida_efectiva);
                const confirmed = authorizations.filter(auth => auth.salida_efectiva);
                
                console.log(`📈 Estadísticas: ${pending.length} pendientes, ${confirmed.length} confirmadas`);
                
                // Actividad de la última hora
                const oneHourAgo = new Date();
                oneHourAgo.setHours(oneHourAgo.getHours() - 1);
                const recentActivity = authorizations.filter(auth => 
                    new Date(auth.fecha_creacion) > oneHourAgo || 
                    (auth.salida_efectiva && new Date(auth.salida_efectiva) > oneHourAgo)
                );

                // Actualizar estadísticas básicas primero
                document.getElementById('dashPendingCount').textContent = pending.length;
                document.getElementById('dashConfirmedCount').textContent = confirmed.length;
                document.getElementById('dashTotalCount').textContent = authorizations.length;
                document.getElementById('dashRecentCount').textContent = recentActivity.length;

                console.log('✅ Estadísticas básicas actualizadas');

                // Iniciar carga de gráficos sin bloquear estadísticas
                const chartsPromise = (async () => {
                    try {
                        console.log('🔍 Verificando disponibilidad de ECharts...');
                        const echartsAvailable = await ensureEChartsLoaded();
                        if (echartsAvailable) {
                            console.log('✅ ECharts disponible, cargando gráficos completos...');
                            await loadDashboardCharts(authorizations);
                        } else {
                            console.log('⚠️ ECharts no disponible, usando gráficos simples...');
                            createSimpleCharts();
                            updateSimpleCharts(pending.length, confirmed.length);
                        }
                    } catch (chartError) {
                        console.error('❌ Error al cargar gráficos:', chartError);
                        createSimpleCharts();
                        updateSimpleCharts(pending.length, confirmed.length);
                    }
                })();

                // Cargar actividad reciente mientras se procesan los gráficos
                await loadDashboardActivity(authorizations);
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

        async function loadDashboardCharts(authorizations) {
            try {
                console.log('📊 Cargando datos para gráficos...');
                
                // Obtener datos relacionados para gráficos
                const studentIds = [...new Set(authorizations.map(auth => auth.estudiante_id))];
                const reasonIds = [...new Set(authorizations.map(auth => auth.motivo_id))];

                let students = [];
                let reasons = [];

                // Consultas separadas más robustas
                if (studentIds.length > 0) {
                    const { data: studentsData, error: studentsError } = await supabaseClient
                        .from('estudiantes')
                        .select(`
                            id, 
                            nombre, 
                            apellidos,
                            grado:grados(nombre)
                        `)
                        .in('id', studentIds);

                    if (studentsError) {
                        console.error('Error cargando estudiantes:', studentsError);
                    } else {
                        students = studentsData || [];
                    }
                }

                if (reasonIds.length > 0) {
                    const { data: reasonsData, error: reasonsError } = await supabaseClient
                        .from('motivos')
                        .select('id, nombre')
                        .in('id', reasonIds);

                    if (reasonsError) {
                        console.error('Error cargando motivos:', reasonsError);
                    } else {
                        reasons = reasonsData || [];
                    }
                }

                // Crear mapas para búsqueda rápida
                const studentMap = {};
                const reasonMap = {};

                students.forEach(student => {
                    studentMap[student.id] = student;
                });

                reasons.forEach(reason => {
                    reasonMap[reason.id] = reason;
                });

                // Enriquecer datos de autorizaciones
                const enrichedAuthorizations = authorizations.map(auth => ({
                    ...auth,
                    estudiante: studentMap[auth.estudiante_id],
                    motivo: reasonMap[auth.motivo_id]
                }));

                // Crear gráficos con datos enriquecidos
                const pending = enrichedAuthorizations.filter(auth => !auth.salida_efectiva);
                const confirmed = enrichedAuthorizations.filter(auth => auth.salida_efectiva);

                createStatusChart(pending.length, confirmed.length);
                createGradeChart(enrichedAuthorizations);
                createReasonChart(enrichedAuthorizations);
                createTimelineChart(enrichedAuthorizations);

                console.log('✅ Gráficos creados exitosamente');

            } catch (error) {
                console.error('❌ Error cargando datos para gráficos:', error);
                // Crear gráficos básicos en caso de error
                const pending = authorizations.filter(auth => !auth.salida_efectiva);
                const confirmed = authorizations.filter(auth => auth.salida_efectiva);
                createStatusChart(pending.length, confirmed.length);
                createGradeChart([]);
                createReasonChart([]);
                createTimelineChart([]);
            }
        }

        async function loadDashboardActivity(authorizations) {
            try {
                console.log('📊 Cargando actividad reciente...');

                const studentIds = [...new Set(authorizations.map(auth => auth.estudiante_id))];
                const userIds = [...new Set(authorizations
                    .flatMap(auth => [auth.usuario_autorizador_id, auth.usuario_modifico_id])
                    .filter(Boolean))];
                const vigilanteIds = [...new Set(authorizations.filter(auth => auth.vigilante_id).map(auth => auth.vigilante_id))];
                const allUserIds = [...new Set([...userIds, ...vigilanteIds])];

                let students = [];
                let users = [];

                if (studentIds.length > 0) {
                    const { data: studentsData, error: studentsError } = await supabaseClient
                        .from('estudiantes')
                        .select('id, nombre, apellidos, grado:grados(nombre)')
                        .in('id', studentIds);

                    if (studentsError) {
                        console.error('Error cargando estudiantes:', studentsError);
                    } else {
                        students = studentsData || [];
                    }
                }

                if (allUserIds.length > 0) {
                    const { data: usersData, error: usersError } = await supabaseClient
                        .from('usuarios')
                        .select('id, nombre')
                        .in('id', allUserIds);

                    if (usersError) {
                        console.error('Error cargando usuarios:', usersError);
                    } else {
                        users = usersData || [];
                    }
                }

                const studentMap = {};
                students.forEach(student => {
                    studentMap[student.id] = student;
                });

                const userMap = {};
                users.forEach(user => {
                    userMap[user.id] = user;
                });

                // Enriquecer con datos de estudiantes y usuarios
                const enrichedForActivity = authorizations.map(auth => ({
                    ...auth,
                    estudiante: studentMap[auth.estudiante_id],
                    usuario: userMap[auth.usuario_autorizador_id],
                    vigilante: userMap[auth.vigilante_id]
                }));

                displayRecentActivity(enrichedForActivity.slice(0, 15));
                console.log('✅ Actividad reciente cargada');

            } catch (error) {
                console.error('❌ Error cargando actividad:', error);
                // Mostrar actividad básica
                displayRecentActivity(authorizations.slice(0, 10));
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
                        label: { show: false },
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

        function createGradeChart(authorizations) {
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
                    dashboardCharts.gradeChart.destroy();
                }
                const gradeData = {};
                authorizations.forEach(auth => {
                    const gradeName = auth.estudiante?.grado?.nombre || 'Sin grado';
                    if (!gradeData[gradeName]) {
                        gradeData[gradeName] = { pending: 0, confirmed: 0 };
                    }
                    if (auth.salida_efectiva) {
                        gradeData[gradeName].confirmed++;
                    } else {
                        gradeData[gradeName].pending++;
                    }
                });
                const pendingData = labels.map(g => gradeData[g].pending);
                const confirmedData = labels.map(g => gradeData[g].confirmed);
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
                            { name: '🟢 Pendientes', type: 'bar', data: pendingData, itemStyle: { color: '#2ecc71' } },
                            { name: '🔵 Confirmadas', type: 'bar', data: confirmedData, itemStyle: { color: '#3498db' } }
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

        function createReasonChart(authorizations) {
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
                    dashboardCharts.reasonChart.destroy();
                }
                const reasonData = {};
                authorizations.forEach(auth => {
                    const reasonName = auth.motivo?.nombre || 'Sin motivo';
                    reasonData[reasonName] = (reasonData[reasonName] || 0) + 1;
                });
                const labels = Object.keys(reasonData);
                const data = Object.values(reasonData);
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
                            data: seriesData
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

        function createTimelineChart(authorizations) {
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
                authorizations.forEach(auth => {
                    if (auth.hora_salida) {
                        const hour = parseInt(auth.hora_salida.split(':')[0]);
                        if (hour >= 6 && hour <= 18) {
                            if (auth.salida_efectiva) {
                                hourlyData[hour].confirmed++;
                            } else {
                                hourlyData[hour].pending++;
                            }
                        }
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
                if (!validateSession()) {
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
                        .select('*')
                        .eq('fecha_salida', todayColombia)
                        .eq('vigilante_id', currentUser.id)
                        .not('salida_efectiva', 'is', null)
                        .order('salida_efectiva', { ascending: false }),
                    supabaseClient
                        .from('autorizaciones_personal')
                        .select('*')
                        .eq('fecha_salida', todayColombia)
                        .eq('vigilante_id', currentUser.id)
                        .not('salida_efectiva', 'is', null)
                        .order('salida_efectiva', { ascending: false }),
                    supabaseClient
                        .from('autorizaciones_personal')
                        .select('*')
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

                
                const studentIds = [...new Set(myConfirmations.map(auth => auth.estudiante_id))];
                const staffIds = [...new Set([
                    ...myStaffExitConfirmations.map(auth => auth.colaborador_id),
                    ...myStaffReturnConfirmations.map(auth => auth.colaborador_id)
                ])];
                const reasonIds = [...new Set([
                    ...myConfirmations.map(auth => auth.motivo_id),
                    ...myStaffExitConfirmations.map(auth => auth.motivo_id),
                    ...myStaffReturnConfirmations.map(auth => auth.motivo_id)
                ].filter(Boolean))];
                const userIds = [...new Set([
                    ...myConfirmations.map(auth => auth.usuario_autorizador_id),
                    ...myStaffExitConfirmations.map(auth => auth.usuario_autorizador_id),
                    ...myStaffReturnConfirmations.map(auth => auth.usuario_autorizador_id)
                ])];

                const [studentsResult, staffResult, reasonsResult, usersResult] = await Promise.all([
                    studentIds.length > 0
                        ? supabaseClient.from('estudiantes').select('id, nombre, apellidos, grado:grados(nombre), foto_url').in('id', studentIds)
                        : Promise.resolve({ data: [] }),
                    staffIds.length > 0
                        ? supabaseClient.from('personal_colegio').select('id, nombre, cargo, cedula').in('id', staffIds)
                        : Promise.resolve({ data: [] }),
                    reasonIds.length > 0
                        ? supabaseClient.from('motivos').select('id, nombre').in('id', reasonIds)
                        : Promise.resolve({ data: [] }),
                    userIds.length > 0
                        ? supabaseClient.from('usuarios').select('id, nombre, email').in('id', userIds)
                        : Promise.resolve({ data: [] })
                ]);
                const studentMap = {};
                const staffMap = {};
                const reasonMap = {};
                const userMap = {};

                studentsResult.data?.forEach(student => {
                    studentMap[student.id] = student;
                });

                staffResult.data?.forEach(staff => {
                    staffMap[staff.id] = staff;
                });
                    
                reasonsResult.data?.forEach(reason => {
                    reasonMap[reason.id] = reason;
                });

                usersResult.data?.forEach(user => {
                    userMap[user.id] = user;
                });

                const currentTime = getColombiaTime();
                let html = `<div style="text-align: center; margin-bottom: 25px; background: rgba(52, 152, 219, 0.1); padding: 20px; border-radius: 10px;">
                    <p style="color: #2c3e50; font-weight: bold; font-size: 16px;">📅 ${formatDate(todayColombia)} - 🕐 ${currentTime} (Hora Colombia)</p>
                    <p style="color: #7f8c8d; margin-top: 8px;">Salidas confirmadas por mí: <strong>${totalRecords}</strong> (Estudiantes: ${myConfirmations.length} • Personal: ${myStaffExitConfirmations.length} • Regresos: ${myStaffReturnConfirmations.length})</p>
                </div>`;
                    
                myConfirmations.forEach(auth => {
                    const student = studentMap[auth.estudiante_id];
                    const reason = reasonMap[auth.motivo_id];
                    const user = userMap[auth.usuario_autorizador_id];
                    const modifier = auth.usuario_modifico_id ? userMap[auth.usuario_modifico_id] : null;
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
                    const staff = staffMap[auth.colaborador_id];
                    const reason = reasonMap[auth.motivo_id];
                    const user = userMap[auth.usuario_autorizador_id];

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
                    const staff = staffMap[auth.colaborador_id];
                    const reason = reasonMap[auth.motivo_id];
                    const user = userMap[auth.usuario_autorizador_id];

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

        function generateCSVFromLogs(logs) {
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

                return [
                    formatDateTime(log.timestamp),
                    log.usuario ? log.usuario.nombre : 'Sistema',
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
        // FUNCIONES DE SCROLL MEJORADO PARA TABLAS
        // ========================================

        function setupTableScroll() {
            const tableWrappers = document.querySelectorAll('.table-wrapper');
            
            tableWrappers.forEach(wrapper => {
                // Configurar listeners de scroll
                wrapper.addEventListener('scroll', function() {
                    updateScrollIndicators(this);
                });

                // Configurar scroll inicial
                updateScrollIndicators(wrapper);
                
                // Agregar smooth scrolling
                wrapper.style.scrollBehavior = 'smooth';
            });
        }

        function updateScrollIndicators(wrapper) {
            const scrollLeft = wrapper.scrollLeft;
            const scrollWidth = wrapper.scrollWidth;
            const clientWidth = wrapper.clientWidth;
            
            // Verificar si necesita scroll
            if (scrollWidth <= clientWidth) {
                wrapper.classList.remove('has-scroll-left', 'has-scroll-right');
                return;
            }

            // Indicador izquierdo (hay contenido a la izquierda)
            if (scrollLeft > 5) {
                wrapper.classList.add('has-scroll-left');
            } else {
                wrapper.classList.remove('has-scroll-left');
            }

            // Indicador derecho (hay contenido a la derecha)
            if (scrollLeft < scrollWidth - clientWidth - 5) {
                wrapper.classList.add('has-scroll-right');
            } else {
                wrapper.classList.remove('has-scroll-right');
            }
        }

        // Función para centrar una columna específica en la vista
        function scrollToColumn(tableId, columnIndex) {
            const table = document.getElementById(tableId);
            if (!table) return;

            const wrapper = table.closest('.table-wrapper');
            if (!wrapper) return;

            const headerCells = table.querySelectorAll('thead th');
            if (columnIndex >= headerCells.length) return;

            const targetCell = headerCells[columnIndex];
            const cellLeft = targetCell.offsetLeft;
            const cellWidth = targetCell.offsetWidth;
            const wrapperWidth = wrapper.clientWidth;

            // Calcular posición para centrar la columna
            const scrollPosition = cellLeft - (wrapperWidth / 2) + (cellWidth / 2);
            
            wrapper.scrollTo({
                left: Math.max(0, scrollPosition),
                behavior: 'smooth'
            });
        }

        // Función para mejorar la experiencia táctil
        function enhanceTouchExperience() {
            // Agregar feedback táctil a botones
            const buttons = document.querySelectorAll('.btn');
            
            buttons.forEach(button => {
                button.addEventListener('touchstart', function() {
                    this.style.transform = 'scale(0.95)';
                }, { passive: true });
                
                button.addEventListener('touchend', function() {
                    setTimeout(() => {
                        this.style.transform = '';
                    }, 100);
                }, { passive: true });
            });
        }

        // Función para manejar el cambio de orientación
        function handleOrientationChange() {
            // Esperar a que la orientación cambie completamente
            setTimeout(() => {
                detectDeviceAndAdjustUI();
                optimizeTableScroll();
            }, 200);
        }

        // Función para optimizar el viewport en dispositivos móviles
        function optimizeViewport() {
            // Prevenir zoom en inputs en iOS
            const inputs = document.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.addEventListener('focus', function() {
                    if (window.innerWidth <= 480) {
                        // Scroll suave al input enfocado
                        setTimeout(() => {
                            this.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center'
                            });
                        }, 300);
                    }
                });
            });
        }

        // Función para crear botones de acción rápida en móvil
        function createMobileQuickActions() {
            if (window.innerWidth > 480) return;
            
            const quickActions = document.createElement('div');
            quickActions.id = 'mobileQuickActions';
            quickActions.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 999;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            
            // Botón de scroll to top
            const scrollTopBtn = document.createElement('button');
            scrollTopBtn.innerHTML = '↑';
            scrollTopBtn.className = 'btn btn-secondary';
            scrollTopBtn.style.cssText = `
                width: 50px;
                height: 50px;
                border-radius: 50%;
                font-size: 20px;
                font-weight: bold;
                display: none;
            `;
            
            scrollTopBtn.addEventListener('click', () => {
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            });
            
            // Mostrar/ocultar botón según scroll
            let scrollTimeout;
            window.addEventListener('scroll', () => {
                if (window.scrollY > 200) {
                    scrollTopBtn.style.display = 'block';
                } else {
                    scrollTopBtn.style.display = 'none';
                }
                
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    if (window.scrollY > 200) {
                        scrollTopBtn.style.opacity = '0.7';
                    }
                }, 2000);
            });
            
            quickActions.appendChild(scrollTopBtn);
            document.body.appendChild(quickActions);
        }
        
        // Configuración de Supabase
        let envExists = false;
        if (typeof window !== 'undefined' && window.process && window.process.env) {
            envExists = true;
        } else {
            updateConnectionStatus(false, 'Configuración no encontrada');
            console.error('❌ process.env no disponible. Configuración no encontrada');
        }

        const SUPABASE_URL = envExists ? window.process.env.SUPABASE_URL : '';
        const SUPABASE_ANON_KEY = envExists ? window.process.env.SUPABASE_ANON_KEY : '';
        const STORAGE_BUCKET = 'autorizaciones';
        const EXIT_EDIT_USERS = [
            'convivencia@colgemelli.edu.co',
            'sistemas@colgemelli.edu.co'
        ];

        let supabaseClient;
        let currentUser = null;
        let currentEditingId = null;
        let currentExitAuthId = null;
        let currentExitOriginalData = null;
        let currentStaffAuthId = null;
        let currentExitLockedStudentId = null;
        let currentExitLockedGradeId = null;
        let sessionToken = null;
        let loginAttempts = 0;
        let lastLoginAttempt = null;
        let sessionStartTime = null;
        let sessionTimeout = null;
        let lastActivityTime = null;
        let rolesCache = [];

        // Configuración de seguridad
        const MAX_LOGIN_ATTEMPTS = 5;
        const LOGIN_COOLDOWN = 300000; // 5 minutos
        const SESSION_TIMEOUT = 1800000; // 30 minutos
        const IDLE_TIMEOUT = 600000; // 10 minutos
        const SESSION_STORAGE_KEY = 'app_session_state';
        const CSRF_TOKEN = getOrCreateCSRFToken();
        const SECURE_HEADERS = {
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': CSRF_TOKEN
        };

        // ========================================
        // FUNCIONES DE SEGURIDAD AVANZADAS
        // ========================================

        // Generar token CSRF
        function generateCSRFToken() {
            return 'csrf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
        }

        function storeCSRFToken(token) {
            document.cookie = `csrf_token=${token}; path=/; Secure; SameSite=Strict`;
            let meta = document.querySelector('meta[name="csrf-token"]');
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = 'csrf-token';
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', token);
        }

        function getCSRFToken() {
            const meta = document.querySelector('meta[name="csrf-token"]');
            if (meta) return meta.getAttribute('content');
            const match = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
            return match ? match[1] : null;
        }

        function getOrCreateCSRFToken() {
            let token = getCSRFToken();
            if (!token) {
                token = generateCSRFToken();
            }
            storeCSRFToken(token);
            return token;
        }

        // Función de sanitización XSS mejorada
        function sanitizeHtml(str) {
            if (!str) return '';
            
            // Crear elemento temporal para escape
            const temp = document.createElement('div');
            temp.textContent = str;
            let escaped = temp.innerHTML;
            
            // Filtros adicionales contra XSS
            escaped = escaped.replace(/javascript:/gi, '')
                           .replace(/vbscript:/gi, '')
                           .replace(/data:/gi, '')
                           .replace(/on\w+=/gi, '')
                           .replace(/<script[^>]*>.*?<\/script>/gi, '')
                           .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
                           .replace(/<object[^>]*>.*?<\/object>/gi, '')
                           .replace(/<embed[^>]*>/gi, '')
                           .replace(/<link[^>]*>/gi, '')
                           .replace(/<meta[^>]*>/gi, '');
            
            return escaped;
        }

        // Función de cifrado de contraseñas
        function encryptPassword(password) {
            if (!password) return '';
            try {
                // Crear salt único
                const salt = CryptoJS.lib.WordArray.random(32);
                const iterations = 10000;
                
                // Derivar clave usando PBKDF2
                const key = CryptoJS.PBKDF2(password, salt, {
                    keySize: 256/32,
                    iterations: iterations,
                    hasher: CryptoJS.algo.SHA256
                });
                
                // Cifrar con AES
                const encrypted = CryptoJS.AES.encrypt(password, key.toString()).toString();
                
                // Combinar salt + iterations + encrypted
                return salt.toString() + ':' + iterations + ':' + encrypted;
            } catch (error) {
                console.error('Error al cifrar contraseña:', error);
                return CryptoJS.SHA256(password).toString(); // Fallback a SHA256
            }
        }

        // Función para verificar contraseña
        function verifyPassword(password, hash) {
            if (!password || !hash) return false;
            
            try {
                 if (hash.startsWith('sha256$')) {
                    const digest = hash.substring(7);
                    const computed = CryptoJS.SHA256(password).toString();
                    return computed === digest;
                }
                
                // Si es el formato nuevo (salt:iterations:encrypted)
                if (hash.includes(':')) {
                    const parts = hash.split(':');
                    if (parts.length === 3) {
                        const salt = CryptoJS.enc.Hex.parse(parts[0]);
                        const iterations = parseInt(parts[1]);
                        const encrypted = parts[2];
                        
                        // Derivar la misma clave
                        const key = CryptoJS.PBKDF2(password, salt, {
                            keySize: 256/32,
                            iterations: iterations,
                            hasher: CryptoJS.algo.SHA256
                        });
                        
                        // Intentar descifrar
                        try {
                            const decrypted = CryptoJS.AES.decrypt(encrypted, key.toString()).toString(CryptoJS.enc.Utf8);
                            return decrypted === password;
                        } catch {
                            return false;
                        }
                    }
                }
                
                // Fallback: comparación directa para contraseñas no cifradas (legacy)
                return password === hash;
                
            } catch (error) {
                console.error('Error al verificar contraseña:', error);
                return false;
            }
        }

        // Validación de email mejorada
        function validateEmail(email) {
            if (!email) return false;
            
            // Verificar longitud
            if (email.length > 100) return false;
            
            // Patrón RFC compliant
            const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
            
            // Verificar patrón básico
            if (!emailPattern.test(email)) return false;
            
            // Verificar caracteres peligrosos
            const dangerousChars = /<|>|"|'|;|&|javascript:|vbscript:|data:/i;
            if (dangerousChars.test(email)) return false;
            
            return true;
        }

        // Validación de contraseña mejorada
        function validatePassword(password) {
            if (!password) return false;
            if (password.length < 8 || password.length > 50) return false;
            
            // Verificar caracteres peligrosos
            const dangerousChars = /<|>|"|'|;|&|javascript:|vbscript:|data:/i;
            if (dangerousChars.test(password)) return false;
            
            return true;
        }

        // Validación de nombres
        function validateName(name) {
            if (!name) return false;
            if (name.length < 2 || name.length > 50) return false;
            
            // Solo letras, espacios y acentos
            const namePattern = /^[A-Za-zÀ-ÿ\u00f1\u00d1\s]{2,50}$/;
            if (!namePattern.test(name)) return false;
            
            // Verificar caracteres peligrosos
            const dangerousChars = /<|>|"|'|;|&|javascript:|vbscript:|data:/i;
            if (dangerousChars.test(name)) return false;
            
            return true;
        }

        // Validación de documento
        function validateDocument(document) {
            if (!document) return true; // Es opcional
            
            // Solo números, 6-20 dígitos
            const docPattern = /^[0-9]{6,20}$/;
            return docPattern.test(document);
        }

        // Validación de texto general
        function validateText(text) {
            if (!text) return true; // Campos opcionales
            
            // Verificar caracteres peligrosos
            const dangerousChars = /<script|<iframe|<object|<embed|javascript:|vbscript:|data:|on\w+=/i;
            if (dangerousChars.test(text)) return false;
            
            return true;
        }

        // ========================================
        // FUNCIONES DE VALIDACIÓN EN TIEMPO REAL
        // ========================================

        function validateEmailInput(input) {
            const value = input.value.trim();
            
            if (!value) {
                input.className = input.className.replace(/input-(secure|warning|error)/g, '');
                return;
            }
            
            if (validateEmail(value)) {
                input.className = input.className.replace(/input-(warning|error)/g, '');
                input.classList.add('input-secure');
            } else {
                input.className = input.className.replace(/input-(secure|warning)/g, '');
                input.classList.add('input-error');
            }
        }

        function validatePasswordInput(input) {
            const value = input.value;
            
            if (!value) {
                input.className = input.className.replace(/input-(secure|warning|error)/g, '');
                return;
            }
            
            if (validatePassword(value)) {
                const strength = calculatePasswordStrength(value);
                if (strength >= 4) {
                    input.className = input.className.replace(/input-(warning|error)/g, '');
                    input.classList.add('input-secure');
                } else {
                    input.className = input.className.replace(/input-(secure|error)/g, '');
                    input.classList.add('input-warning');
                }
            } else {
                input.className = input.className.replace(/input-(secure|warning)/g, '');
                input.classList.add('input-error');
            }
        }

        function validateNameInput(input) {
            const value = input.value.trim();
            
            if (!value) {
                input.className = input.className.replace(/input-(secure|warning|error)/g, '');
                return;
            }
            
            if (validateName(value)) {
                input.className = input.className.replace(/input-(warning|error)/g, '');
                input.classList.add('input-secure');
            } else {
                input.className = input.className.replace(/input-(secure|warning)/g, '');
                input.classList.add('input-error');
            }
        }

        function validateDocumentInput(input) {
            const value = input.value.trim();
            
            if (!value) {
                input.className = input.className.replace(/input-(secure|warning|error)/g, '');
                return;
            }
            
            if (validateDocument(value)) {
                input.className = input.className.replace(/input-(warning|error)/g, '');
                input.classList.add('input-secure');
            } else {
                input.className = input.className.replace(/input-(secure|warning)/g, '');
                input.classList.add('input-error');
            }
        }

        function validateTextInput(input) {
            const value = input.value;
            
            if (!value) {
                input.className = input.className.replace(/input-(secure|warning|error)/g, '');
                return;
            }
            
            if (validateText(value)) {
                input.className = input.className.replace(/input-(warning|error)/g, '');
                input.classList.add('input-secure');
            } else {
                input.className = input.className.replace(/input-(secure|warning)/g, '');
                input.classList.add('input-error');
            }
        }

        function validateSearchInput(input) {
            const value = input.value.trim();
            
            if (!value) {
                input.className = input.className.replace(/input-(secure|warning|error)/g, '');
                return;
            }
            
            if (validateText(value) && value.length >= 3) {
                input.className = input.className.replace(/input-(warning|error)/g, '');
                input.classList.add('input-secure');
                
                // Trigger search with debounce
                clearTimeout(input.searchTimeout);
                input.searchTimeout = setTimeout(() => {
                    searchStudent();
                }, 500);
            } else if (value.length < 3) {
                input.className = input.className.replace(/input-(secure|error)/g, '');
                input.classList.add('input-warning');
            } else {
                input.className = input.className.replace(/input-(secure|warning)/g, '');
                input.classList.add('input-error');
            }
        }

        function togglePasswordVisibility(id, el) {
            const input = document.getElementById(id);
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    el.classList.add('visible');
                } else {
                    input.type = 'password';
                    el.classList.remove('visible');
                }
            }
        }

        // ========================================
        // FUNCIONES DE TOKENS Y SESIONES SEGURAS
        // ========================================

        function generateSecureToken() {
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            return 'sess_' + Date.now() + '_' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        }

        function saveSessionState() {
            if (!sessionToken || !sessionStartTime || !currentUser) {
                return;
            }

            const sessionState = {
                token: sessionToken,
                startTime: sessionStartTime,
                lastActivity: lastActivityTime || sessionStartTime,
                user: {
                    id: currentUser.id,
                    nombre: currentUser.nombre,
                    email: currentUser.email,
                    rol: currentUser.rol
                }
            };

            try {
                localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionState));
            } catch (error) {
                console.warn('No fue posible persistir la sesión:', error);
            }
        }

        function clearSessionState() {
            try {
                localStorage.removeItem(SESSION_STORAGE_KEY);
            } catch (error) {
                console.warn('No fue posible limpiar la sesión persistida:', error);
            }
        }

        function restoreSessionState() {
            let stored = null;

            try {
                stored = localStorage.getItem(SESSION_STORAGE_KEY);
            } catch (error) {
                console.warn('No fue posible leer la sesión persistida:', error);
                return false;
            }

            if (!stored) return false;

            let sessionState;
            try {
                sessionState = JSON.parse(stored);
            } catch (error) {
                clearSessionState();
                return false;
            }

            if (!sessionState?.token || !sessionState?.startTime || !sessionState?.user) {
                clearSessionState();
                return false;
            }

            sessionToken = sessionState.token;
            sessionStartTime = sessionState.startTime;
            lastActivityTime = sessionState.lastActivity || sessionState.startTime;
            currentUser = sessionState.user;

            if (!validateSession()) {
                clearSessionState();
                sessionToken = null;
                sessionStartTime = null;
                lastActivityTime = null;
                currentUser = null;
                return false;
            }

            lastActivityTime = Date.now();
            saveSessionState();
            return true;
        }

        function validateSession() {
            if (!sessionToken || !sessionStartTime) {
                return false;
            }
            
            const now = Date.now();
            if (now - sessionStartTime > SESSION_TIMEOUT) {
                return false;
            }

            if (lastActivityTime && now - lastActivityTime > IDLE_TIMEOUT) {
                return false;
            }
                
            return true;
        }

        function renewSession() {
            if (validateSession()) {
                sessionStartTime = Date.now();
                lastActivityTime = Date.now();
                saveSessionState();
                resetSessionTimeout();
                return true;
            }
            return false;
        }

        // ========================================
        // FUNCIONES DE RATE LIMITING MEJORADAS
        // ========================================

        function checkRateLimit() {
            const now = Date.now();
            const clientId = getClientId();
            
            // Obtener intentos desde localStorage (por cliente)
            const attemptsKey = `login_attempts_${clientId}`;
            const lastAttemptKey = `last_attempt_${clientId}`;
            
            const storedAttempts = localStorage.getItem(attemptsKey);
            const storedLastAttempt = localStorage.getItem(lastAttemptKey);
            
            const attempts = storedAttempts ? parseInt(storedAttempts) : 0;
            const lastAttempt = storedLastAttempt ? parseInt(storedLastAttempt) : 0;
            
            if (attempts >= MAX_LOGIN_ATTEMPTS) {
                if (now - lastAttempt < LOGIN_COOLDOWN) {
                    const remainingTime = Math.ceil((LOGIN_COOLDOWN - (now - lastAttempt)) / 1000);
                    showRateLimitWarning(remainingTime);
                    return false;
                } else {
                    // Reset intentos después del cooldown
                    localStorage.setItem(attemptsKey, '0');
                    localStorage.removeItem(lastAttemptKey);
                }
            }
            
            return true;
        }

        function recordFailedAttempt() {
            const clientId = getClientId();
            const attemptsKey = `login_attempts_${clientId}`;
            const lastAttemptKey = `last_attempt_${clientId}`;
            
            const storedAttempts = localStorage.getItem(attemptsKey);
            const attempts = storedAttempts ? parseInt(storedAttempts) + 1 : 1;
            
            localStorage.setItem(attemptsKey, attempts.toString());
            localStorage.setItem(lastAttemptKey, Date.now().toString());
        }

        function getClientId() {
            let clientId = localStorage.getItem('client_id');
            if (!clientId) {
                clientId = 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('client_id', clientId);
            }
            return clientId;
        }

        // ========================================
        // FUNCIONES DE DESAFÍO ARITMÉTICO
        // ========================================

        let captchaResult = 0;

        function generateCaptcha() {
            const a = Math.floor(Math.random() * 9) + 1;
            const b = Math.floor(Math.random() * 9) + 1;
            captchaResult = a + b;
            const question = document.getElementById('captchaQuestion');
            const input = document.getElementById('captchaAnswer');
            if (question) question.textContent = `¿Cuánto es ${a} + ${b}?`;
            if (input) input.value = '';
        }

        function validateCaptcha() {
            const input = document.getElementById('captchaAnswer');
            if (!input || parseInt(input.value, 10) !== captchaResult) {
                showError('Respuesta incorrecta a la pregunta de seguridad');
                return false;
            }
            return true;
        }

        function resetCaptcha() {
            generateCaptcha();
        }

        // ========================================
        // FUNCIONES DE AUDITORÍA MEJORADAS
        // ========================================

        async function logSecurityEvent(type, action, details = {}, success = true) {
            try {
                const now = new Date();
                const userAgent = navigator.userAgent;
                const clientId = getClientId();
                
                // Obtener información de geolocalización (opcional)
                let location = 'No disponible';
                if (navigator.geolocation && currentUser) {
                    // Solo para usuarios autenticados y con permiso
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            location = `${position.coords.latitude},${position.coords.longitude}`;
                        },
                        () => {
                            location = 'Geolocalización no disponible';
                        },
                        { timeout: 5000 }
                    );
                }

                const logEntry = {
                    usuario_id: currentUser?.id || null,
                    tipo: sanitizeHtml(type),
                    accion: sanitizeHtml(action),
                    detalles: JSON.stringify({
                        ...details,
                        clientId: clientId,
                        sessionToken: sessionToken ? sessionToken.substring(0, 20) + '...' : null,
                        userAgent: userAgent.substring(0, 200), // Limitar longitud
                        timestamp: now.toISOString(),
                        location: location
                    }),
                    ip_address: 'Cliente', // En producción, obtener desde el servidor
                    user_agent: userAgent.substring(0, 500), // Limitar longitud
                    exitoso: success,
                    timestamp: now.toISOString()
                };

                await supabaseClient
                    .from('audit_logs')
                    .insert([logEntry]);
                    
                console.log('🔒 Evento de seguridad registrado:', type, action);
                
            } catch (error) {
                console.error('Error al registrar evento de seguridad:', error);
                // No mostrar error al usuario para no revelar información del sistema
            }
        }

        // ========================================
        // FUNCIONES DE INDICADORES DE SEGURIDAD
        // ========================================

        function updateSecurityIndicator(status, message) {
            const indicator = document.getElementById('securityIndicator');
            if (!indicator) return;
            
            indicator.className = 'security-indicator';
            
            switch (status) {
                case 'secure':
                    indicator.classList.add('secure');
                    indicator.innerHTML = '🔒 ' + message;
                    break;
                case 'warning':
                    indicator.classList.add('warning');
                    indicator.innerHTML = '⚠️ ' + message;
                    break;
                case 'error':
                    indicator.classList.add('error');
                    indicator.innerHTML = '🚨 ' + message;
                    break;
            }
        }

        // ========================================
        // FUNCIONES DE FUERZA DE CONTRASEÑA
        // ========================================

        function calculatePasswordStrength(password) {
            if (!password) return 0;
            
            let strength = 0;
            
            // Longitud
            if (password.length >= 8) strength++;
            if (password.length >= 12) strength++;
            
            // Complejidad
            if (password.match(/[a-z]+/)) strength++;
            if (password.match(/[A-Z]+/)) strength++;
            if (password.match(/[0-9]+/)) strength++;
            if (password.match(/[^a-zA-Z0-9]+/)) strength++;
            
            // Patrones comunes (penalizar)
            const commonPatterns = ['123456', 'password', 'qwerty', 'abc123', '111111'];
            if (commonPatterns.some(pattern => password.toLowerCase().includes(pattern))) {
                strength = Math.max(0, strength - 2);
            }
            
            return Math.min(strength, 6);
        }

        function checkPasswordStrength() {
            const password = document.getElementById('userPassword').value;
            const strengthDiv = document.getElementById('userPasswordStrength');
            
            if (!password) {
                strengthDiv.style.display = 'none';
                return;
            }
            
            strengthDiv.style.display = 'block';
            
            const strength = calculatePasswordStrength(password);
            
            strengthDiv.className = 'password-strength';
            if (strength < 3) {
                strengthDiv.classList.add('weak');
            } else if (strength < 5) {
                strengthDiv.classList.add('medium');
            } else {
                strengthDiv.classList.add('strong');
            }
        }

        function checkGuardPasswordStrength() {
            const password = document.getElementById('guardPassword')?.value;
            const strengthDiv = document.getElementById('guardPasswordStrength');

            if (!strengthDiv) return;

            if (!password) {
                strengthDiv.style.display = 'none';
                return;
            }

            strengthDiv.style.display = 'block';

            const strength = calculatePasswordStrength(password);

            strengthDiv.className = 'password-strength';
            if (strength < 3) {
                strengthDiv.classList.add('weak');
            } else if (strength < 5) {
                strengthDiv.classList.add('medium');
            } else {
                strengthDiv.classList.add('strong');
            }
        }

        // ========================================
        // FUNCIONES PRINCIPALES (MEJORADAS)
        // ========================================

        // Inicializar Supabase con seguridad mejorada
        async function initSupabase() {
            try {
                console.log('🔄 Inicializando Supabase con medidas de seguridad...');
                
                if (!window.supabase) {
                    console.error('❌ window.supabase no está disponible');
                    throw new Error('Supabase no está cargado');
                }
                
                supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: {
                        persistSession: false, // No persistir sesiones por seguridad
                        autoRefreshToken: false
                        },
                    global: {
                        headers: {
                            'X-CSRF-Token': getCSRFToken()
                        }
                    }
                });
                
                console.log('✅ Cliente Supabase creado con configuración segura');
                
                // Verificar conexión
                const { data, error } = await supabaseClient.from('roles').select('*').limit(1);
                
                if (error) throw error;
                
                updateConnectionStatus(true, 'Conexión Segura');
                updateSecurityIndicator('secure', 'Conexión Segura');
                console.log('✅ Conexión segura establecida');
                
                return true;
                
            } catch (error) {
                console.error('❌ Error:', error);
                updateConnectionStatus(false, 'Error de conexión');
                updateSecurityIndicator('error', 'Error de Conexión');
                
                // Log del error de manera segura
                await logSecurityEvent('error', 'Error de conexión', { 
                    error: error.message.substring(0, 200) 
                }, false);
                
                return false;
            }
        }

        // Función de login con seguridad mejorada
        async function login() {
            try {
                // Verificar rate limiting
                if (!checkRateLimit()) {
                    return;
                }

                // Verificar desafío aritmético
                if (!validateCaptcha()) {
                    recordFailedAttempt();
                    return;
                }

                const email = document.getElementById('email').value.trim().toLowerCase();
                const password = document.getElementById('password').value;

                const cryptoReady = ensureCryptoJSLoaded();
                if (!cryptoReady) {
                    showError('No se pudo cargar la librería de cifrado');
                    resetCaptcha();
                    return;
                }

                // Validaciones de seguridad
                if (!email || !password) {
                    showError('Por favor, ingresa email y contraseña');
                    recordFailedAttempt();
                    return;
                }

                if (!validateEmail(email)) {
                    showError('Formato de email inválido');
                    recordFailedAttempt();
                    await logSecurityEvent('login', 'Intento con email inválido', { email: email.substring(0, 20) + '...' }, false);
                    return;
                }

                if (!validatePassword(password)) {
                    showError('Formato de contraseña inválido');
                    recordFailedAttempt();
                    await logSecurityEvent('login', 'Intento con contraseña inválida', { email: email.substring(0, 20) + '...' }, false);
                    return;
                }

                // Deshabilitar botón de login
                const loginBtn = document.getElementById('loginBtn');
                loginBtn.disabled = true;
                loginBtn.textContent = 'Verificando...';

                // Verificar conexión
                const connected = await initSupabase();
                if (!connected) {
                    showError('No se puede conectar a la base de datos. Verifica tu conexión a internet.');
                    resetCaptcha();
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Iniciar Sesión';
                    return;
                }

                console.log('🔐 Intentando login seguro para:', email.substring(0, 5) + '...');
                
                // Buscar usuario en la base de datos
                const { data: user, error } = await supabaseClient
                    .from('usuarios')
                    .select(`
                        *,
                        rol:roles(nombre, descripcion)
                    `)
                    .eq('email', email)
                    .eq('activo', true)
                    .single();

                if (error || !user) {
                    recordFailedAttempt();
                    await logSecurityEvent('login', 'Usuario no encontrado', { email: email.substring(0, 20) + '...' }, false);
                    showError('Credenciales incorrectas');
                    resetCaptcha();
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Iniciar Sesión';
                    return;
                }

                console.log('✅ Usuario encontrado:', user.nombre);

                // Verificar contraseña con cifrado
                if (!verifyPassword(password, user.password_hash)) {
                    recordFailedAttempt();
                    await logSecurityEvent('login', 'Contraseña incorrecta', { 
                        email: email.substring(0, 20) + '...',
                        userId: user.id 
                    }, false);
                    showError('Credenciales incorrectas');
                    resetCaptcha();
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Iniciar Sesión';
                    return;
                }

                console.log('✅ Login exitoso para:', user.nombre);
                
                // Limpiar intentos fallidos
                const clientId = getClientId();
                localStorage.removeItem(`login_attempts_${clientId}`);
                localStorage.removeItem(`last_attempt_${clientId}`);
                
                // Generar token de sesión seguro
                sessionToken = generateSecureToken();
                sessionStartTime = Date.now();
                lastActivityTime = sessionStartTime;
                currentUser = user;
                
                try {
                    localStorage.setItem('correo', user.email);
                    localStorage.setItem('userRole', user.rol?.nombre || '');
                    localStorage.setItem('userName', user.nombre || '');
                } catch (storageError) {
                    console.warn('No fue posible persistir la sesión en localStorage:', storageError);
                }

                saveSessionState();
                
                // Registrar login exitoso
                await logSecurityEvent('login', 'Login exitoso', {
                    userId: user.id, 
                    email: email.substring(0, 20) + '...',
                    role: user.rol.nombre
                }, true);
                
                resetCaptcha();
                showDashboard();
                updateSecurityIndicator('secure', 'Sesión Activa');

            } catch (error) {
                console.error('❌ Error general en login:', error);
                recordFailedAttempt();
                await logSecurityEvent('error', 'Error general en login', { 
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al iniciar sesión. Inténtalo de nuevo.');
                resetCaptcha();
            } finally {
                const loginBtn = document.getElementById('loginBtn');
                loginBtn.disabled = false;
                loginBtn.textContent = 'Iniciar Sesión';
            }
        }

        // Función de logout mejorada
        async function logout() {
            try {
                if (currentUser) {
                    await logSecurityEvent('logout', 'Cierre de sesión', { 
                        userId: currentUser.id,
                        sessionDuration: sessionStartTime ? Date.now() - sessionStartTime : 0
                    }, true);
                }
                
                // Limpiar datos de sesión
                currentUser = null;
                sessionToken = null;
                sessionStartTime = null;
                lastActivityTime = null;
                clearTimeout(sessionTimeout);
                clearSessionState();
                
                try {
                    localStorage.removeItem('correo');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('userName');
                } catch (storageError) {
                    console.warn('No fue posible limpiar los datos de sesión locales:', storageError);
                }
                    
                // Limpiar UI
                document.getElementById('loginSection').style.display = 'block';
                document.getElementById('dashboard').style.display = 'none';
                const logoutBtn = document.getElementById('logoutBtn');
                if (logoutBtn) logoutBtn.style.display = 'none';
                document.getElementById('email').value = '';
                document.getElementById('password').value = '';
                
                // Reiniciar desafío aritmético
                resetCaptcha();
                
                updateSecurityIndicator('secure', 'Conexión Segura');
                showSuccess('Sesión cerrada exitosamente');
                
            } catch (error) {
                console.error('Error en logout:', error);
            }
        }

        // ========================================
        // FUNCIONES DE TIMEOUT DE SESIÓN
        // ========================================

        function resetSessionTimeout() {
            clearTimeout(sessionTimeout);
            sessionTimeout = setTimeout(() => {
                showError('Tu sesión ha expirado por inactividad');
                logout();
            }, IDLE_TIMEOUT);
        }

        // Resetear timeout en actividad del usuario
        function setupActivityListeners() {
            const events = ['click', 'keypress', 'mousemove', 'scroll'];
            events.forEach(event => {
                document.addEventListener(event, () => {
                    if (currentUser && validateSession()) {
                        renewSession();
                    }
                }, { passive: true });
            });
        }

        // ========================================
        // RESTO DE FUNCIONES (COPIADAS DEL ORIGINAL CON MEJORAS DE SEGURIDAD)
        // ========================================

        function updateConnectionStatus(connected, message) {
            const statusElement = document.getElementById('connectionStatus');
            const iconElement = document.getElementById('connectionIcon');
            const textElement = document.getElementById('connectionText');
            
            if (connected) {
                statusElement.className = 'connection-status connected';
                iconElement.textContent = '🟢';
                textElement.textContent = message || 'Conectado';
            } else {
                statusElement.className = 'connection-status disconnected';
                iconElement.textContent = '🔴';
                textElement.textContent = message || 'Desconectado';
            }
        }

        function showError(message, elementId = 'loginError') {
            const errorDiv = document.getElementById(elementId);
            const infoDiv = elementId === 'loginError' ? document.getElementById('loginInfo') : null;

            if (errorDiv) {
                errorDiv.textContent = sanitizeHtml(message);
                errorDiv.classList.add('alert-error');
                errorDiv.classList.remove('alert-success');
                errorDiv.classList.remove('alert-warning');
                if (infoDiv) infoDiv.style.visibility = 'hidden';
                errorDiv.style.visibility = 'visible';
                setTimeout(() => {
                    errorDiv.style.visibility = 'hidden';
                }, 5000);
                if (window.toastError) toastError(message);
            } else {
                alert('❌ ' + sanitizeHtml(message));
            }
        }

        function showWarning(message, elementId = 'loginError') {
            const warnDiv = document.getElementById(elementId);
            const infoDiv = elementId === 'loginError' ? document.getElementById('loginInfo') : null;

            if (warnDiv) {
                warnDiv.textContent = sanitizeHtml(message);
                warnDiv.classList.add('alert-warning');
                warnDiv.classList.remove('alert-error');
                warnDiv.classList.remove('alert-success');
                if (infoDiv) infoDiv.style.visibility = 'hidden';
                warnDiv.style.visibility = 'visible';
                setTimeout(() => {
                    warnDiv.style.visibility = 'hidden';
                }, 5000);
                if (window.toastWarning) toastWarning(message);
            } else {
                alert('⚠️ ' + sanitizeHtml(message));
            }
        }

        function showSuccess(message, elementId = 'loginInfo') {
            const infoDiv = document.getElementById(elementId);
            const errorDiv = elementId === 'loginInfo' ? document.getElementById('loginError') : null;
            if (infoDiv) {
                infoDiv.textContent = sanitizeHtml(message);
                 if (errorDiv) errorDiv.style.visibility = 'hidden';
                infoDiv.classList.add('alert-success');
                infoDiv.classList.remove('alert-error');
                infoDiv.style.visibility = 'visible';
                if (errorDiv) errorDiv.style.visibility = 'hidden';
                setTimeout(() => {
                    infoDiv.style.visibility = 'hidden';
                }, 5000);
                if (window.toastSuccess) toastSuccess(message);
            } else {
                alert('✅ ' + sanitizeHtml(message));
            }
        }

        function showRateLimitWarning(seconds) {
            const warning = document.getElementById('rateLimitWarning');
            warning.textContent = `⚠️ Demasiados intentos. Espera ${seconds} segundos antes de intentar de nuevo.`;
            warning.style.display = 'block';
            setTimeout(() => {
                warning.style.display = 'none';
            }, 5000);
        }

        function requestNotificationPermission() {
            if (!('Notification' in window)) return;
            try {
                Notification.requestPermission().then(permission => {
                    console.log('🔔 Permiso de notificación:', permission);
                });
            } catch (e) {
                console.error('Error solicitando permiso de notificación:', e);
            }
        }

        function sendNotification(title, body) {
            if (!('Notification' in window)) return;
            if (Notification.permission !== 'granted') return;
            try {
                new Notification(title, { body });
            } catch (e) {
                console.error('Error enviando notificación:', e);
            }
        }

        async function testConnection() {
            updateConnectionStatus(false, 'Probando...');
            updateSecurityIndicator('warning', 'Probando Conexión');
            
            try {
                console.log('🔄 Test de conexión segura');
                
                if (!window.supabase) {
                    throw new Error('Supabase no está cargado. Recarga la página.');
                }
                
                const connected = await initSupabase();
                
                if (connected) {
                    showSuccess('✅ Conexión segura establecida!');
                } else {
                    showError('❌ Error en la conexión');
                }
            } catch (error) {
                console.error('❌ Error:', error);
                showError('Error: ' + error.message);
                updateSecurityIndicator('error', 'Error de Conexión');
            }
        }

        // Funciones de utilidad para zona horaria de Colombia
        function getColombiaDate() {
            return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
        }

        function getColombiaDateTime() {
            return new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).replace(' ', 'T');
        }

        function getColombiaTime() {
            return new Date().toLocaleTimeString('sv-SE', { timeZone: 'America/Bogota', hour12: false }).substring(0, 5);
        }

        async function loadLateStudents() {
            const studentList = document.getElementById('lateStudentList');
            const studentSelect = document.getElementById('lateStudentSelect');
            const gradeId = document.getElementById('lateGradeSelect').value;

            if (!gradeId) {
                studentList.innerHTML = '';
                studentList.dataset.disabled = 'true';
                return;
            }

            try {
                if (!validateSession()) return;

                studentList.textContent = 'Cargando estudiantes...';
                studentList.dataset.disabled = 'true';

                const { data: students, error } = await supabaseClient
                    .from('estudiantes')
                    .select(`id, nombre, apellidos`)
                    .eq('grado_id', gradeId)
                    .eq('activo', true)
                    .order('apellidos')
                    .order('nombre');

                if (error) throw error;

                studentList.innerHTML = '';

                if (students && students.length > 0) {
                    students.forEach(student => {
                        const label = document.createElement('label');
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'lateStudentCheckbox';
                        checkbox.value = student.id;
                        checkbox.dataset.name = `${student.apellidos}, ${student.nombre}`;
                        label.appendChild(checkbox);
                        label.appendChild(document.createTextNode(' ' + sanitizeHtml(`${student.apellidos}, ${student.nombre}`)));
                        studentList.appendChild(label);
                    });
                    studentList.dataset.disabled = 'false';
                } else {
                    studentList.textContent = 'No hay estudiantes en este grado';
                }

            } catch (error) {
                console.error('Error loading late students:', error);
                studentList.textContent = 'Error al cargar estudiantes';
                studentList.dataset.disabled = 'true';
                await logSecurityEvent('error', 'Error al cargar estudiantes para llegadas tarde', {
                    gradeId: gradeId,
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function saveLateArrival(e) {
            e.preventDefault();

            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const gradeSelect = document.getElementById('lateGradeSelect');
                const gradeId = gradeSelect.value;
                const boxes = document.querySelectorAll('#lateStudentList input:checked');
                const selectedIds = Array.from(boxes).map(b => b.value);
                const time = document.getElementById('lateTime').value;
                const excuse = document.getElementById('lateExcuse').value === 'true';

                if (!gradeId || selectedIds.length === 0 || !time) {
                    showError('Por favor, completa todos los campos obligatorios', 'lateArrivalError');
                    return;
                }

                const fecha = getColombiaDate();

                 const records = selectedIds.map(id => ({
                    estudiante_id: id,
                    grado_id: gradeId,
                    fecha,
                    hora: time,
                    excusa: excuse,
                    registrado_por: currentUser.id
                }));

                const { error } = await supabaseClient
                    .from('llegadas_tarde')
                    .insert(records);

                if (error) throw error;

                for (const id of selectedIds) {
                    await logSecurityEvent('create', 'Llegada tarde registrada', {
                        studentId: id,
                        gradeId,
                        hora: time
                    }, true);
                }

                const names = Array.from(boxes).map(b => b.dataset.name);
                showSuccess(`Llegada tarde registrada para ${sanitizeHtml(names.join(', '))}`, 'lateArrivalInfo');
                resetLateArrivalForm();

            } catch (error) {
                console.error('Error al registrar llegada tarde:', error);
                await logSecurityEvent('error', 'Error al registrar llegada tarde', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al registrar la llegada tarde: ' + error.message, 'lateArrivalError');
            }
        }

        function resetLateArrivalForm() {
            const studentList = document.getElementById('lateStudentList');
            if (studentList) {
                studentList.innerHTML = '';
                studentList.dataset.disabled = 'true';
            }
        }

        function formatDate(dateString) {
            if (!dateString) return 'N/A';
            const date = new Date(dateString + 'T00:00:00-05:00');
            return date.toLocaleDateString('es-CO', { 
                timeZone: 'America/Bogota',
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
            });
        }

        function formatTime(timeString) {
            if (!timeString) return 'N/A';
            return timeString.substring(0, 5);
        }

        function formatDateTime(dateTimeString) {
            if (!dateTimeString) return 'N/A';
            const date = new Date(dateTimeString);
            return date.toLocaleString('es-CO', { 
                timeZone: 'America/Bogota',
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function showDashboard() {
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('dashboard').style.display = 'block';
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'block';

            setupNavigation();
            loadInitialData();
            resetSessionTimeout();
        }

        function setupNavigation() {
            const navButtons = document.getElementById('navButtons');
            const role = currentUser.rol.nombre;
            const email = currentUser.email;
            const lateUser =
                email === 'convivencia@colgemelli.edu.co' ||
                email === 'sistemas@colgemelli.edu.co' ||
                email === 'gformativa@colgemelli.edu.co';
            const lateBtnHtml = lateUser ?
                `<button id="lateArrivalBtn" class="btn btn-danger" onclick="showSection('lateArrivalSectionDiv')">⏰ Llegadas Tarde</button>` : '';
            navButtons.innerHTML = '';

            if (role === 'administrador') {
                navButtons.innerHTML = `
                ${lateBtnHtml}
                    <button class="btn" onclick="showSection('dashboardSectionDiv')">📊 Dashboard</button>
                    <button class="btn" onclick="showSection('authorizeSectionDiv')">Autorizar Salidas</button>
                    <button class="btn" onclick="showSection('authorizeStaffSectionDiv')">Autorizar Personal</button>
                    <button class="btn" onclick="showSection('visitorEntrySectionDiv')">🧾 Visitantes</button>
                    <button class="btn" onclick="showSection('adminSectionDiv')">Administración</button>
                    <button class="btn" onclick="showSection('historySectionDiv')">Historial</button>
                    <button class="btn" onclick="showSection('verifySectionDiv')">Verificar Salidas</button>
                `;
            } else if (role === 'talento_humano') {
                const staffReportButton = email === 'gadministrativa@colgemelli.edu.co'
                    ? `<button class="btn" onclick="abrirReportePersonal()">👥 Reporte Personal</button>`
                    : '';
                    
                navButtons.innerHTML = `
                    <button class="btn" onclick="showSection('authorizeStaffSectionDiv')">Autorizar Personal</button>
                    <button class="btn" onclick="showSection('historySectionDiv')">Historial</button>
                    ${staffReportButton}
                `;
            } else if (role === 'vigilante' || email === 'vigilancia@colgemelli.edu.co') {
                navButtons.innerHTML = `
                ${lateBtnHtml}
                    <button class="btn" onclick="showSection('dashboardSectionDiv')">📊 Dashboard</button>
                    <button class="btn" onclick="showSection('verifySectionDiv')">Control de Salidas</button>
                    <button class="btn" onclick="showSection('visitorEntrySectionDiv')">🧾 Visitantes</button>
                    <button class="btn" onclick="showSection('historySectionDiv')">Historial</button>
                `;
            } else if (email === 'convivencia@colgemelli.edu.co' || email === 'gformativa@colgemelli.edu.co') {
                // Dashboard especial para convivencia y gestión formativa
                navButtons.innerHTML = `
                ${lateBtnHtml}
                    <button class="btn" onclick="showSection('dashboardSectionDiv')">📊 Dashboard</button>
                    <button class="btn" onclick="showSection('authorizeSectionDiv')">Autorizar Salidas</button>
                    <button class="btn" id="btnControlSalidas" onclick="showSection('verifySectionDiv')">Control de Salidas</button>
                    <button class="btn" onclick="showSection('historySectionDiv')">Historial</button>
                `;
            } else if (email === 'enfermeria@colgemelli.edu.co') {
                // Enfermería NO tiene acceso al dashboard
                navButtons.innerHTML = `
                ${lateBtnHtml}
                    <button class="btn" onclick="showSection('authorizeSectionDiv')">Autorizar Salidas</button>
                    <button class="btn" onclick="showSection('historySectionDiv')">Historial</button>
                `;
            } else {
                // Todos los demás usuarios tienen acceso al dashboard
                navButtons.innerHTML = `
                ${lateBtnHtml}
                    <button class="btn" onclick="showSection('dashboardSectionDiv')">📊 Dashboard</button>
                    <button class="btn" onclick="showSection('authorizeSectionDiv')">Autorizar Salidas</button>
                    <button class="btn" onclick="showSection('historySectionDiv')">Historial</button>
                `;
            }

             const lateBtn = document.getElementById('lateArrivalBtn');
            if (lateBtn) {
                lateBtn.style.display = lateUser ? 'inline-block' : 'none';
            }

            const lateReportBtn = document.getElementById('lateReportBtn');
            if (lateReportBtn) {
                lateReportBtn.style.display = lateUser ? 'inline-block' : 'none';
            }
            
            const generalReportBtn = document.getElementById('generalReportBtn');
            if (generalReportBtn) {
                const allowedReportUsers = [
                    'sistemas@colgemelli.edu.co',
                    'vigilancia@colgemelli.edu.co'
                ];
                generalReportBtn.style.display = allowedReportUsers.includes(email) ? 'inline-block' : 'none';
            }
            
            const staffReportBtn = document.getElementById('staffReportBtn');
            if (staffReportBtn) {
                const allowedStaffReportUsers = [
                    'sistemas@colgemelli.edu.co',
                    'gadministrativa@colgemelli.edu.co'
                ];
                staffReportBtn.style.display = allowedStaffReportUsers.includes(email) ? 'inline-block' : 'none';
            }
                
            // Mostrar la primera sección disponible
            if (role === 'talento_humano') {
                showSection('authorizeStaffSectionDiv');
            } else if (email === 'vigilancia@colgemelli.edu.co') {
                showSection('verifySectionDiv'); // este usuario comienza en Control de Salidas
            } else if (role === 'vigilante') {
                showSection('dashboardSectionDiv'); // Vigilancia comienza con dashboard
            } else if (email === 'convivencia@colgemelli.edu.co' || email === 'gformativa@colgemelli.edu.co') {
                // Convivencia y Gestión Formativa inician en la sección de autorización
                showSection('authorizeSectionDiv');
            } else if (email === 'enfermeria@colgemelli.edu.co') {
                showSection('authorizeSectionDiv'); // Enfermería empieza con autorizar
            } else {
                showSection('dashboardSectionDiv'); // Todos los demás empiezan con dashboard
            }
        }

        function showSection(sectionId) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            document.querySelectorAll('.section').forEach(section => {
                section.classList.remove('active');
            });
            
            document.getElementById(sectionId).classList.add('active');
            
            if (sectionId === 'historySectionDiv') {
                loadHistory(true);
                setTimeout(setupTableScroll, 100);
            } else if (sectionId === 'verifySectionDiv') {
                // Resetear las secciones de vigilancia al estado inicial
                document.getElementById('searchSection').style.display = 'none';
                document.getElementById('myConfirmedSection').style.display = 'none';
                document.getElementById('pendingExitsSection').style.display = 'block';
                
                cargarVerificaciones();

                const permitidos = [
                    'convivencia@colgemelli.edu.co',
                    'vigilancia@colgemelli.edu.co',
                    'sistemas@colgemelli.edu.co'
                ];
                if (currentUser && (currentUser.rol.nombre === 'vigilante' || permitidos.includes(currentUser.email))) {
                    loadPendingExits();
                }
                loadPendingStaffExits();
            } else if (sectionId === 'lateArrivalSectionDiv') {
                const gradeSel = document.getElementById('lateGradeSelect');
                const form = document.getElementById('lateArrivalForm');
                if (gradeSel && !gradeSel.dataset.bound) {
                    gradeSel.addEventListener('change', loadLateStudents);
                    gradeSel.dataset.bound = 'true';
                }
                if (form && !form.dataset.bound) {
                    form.addEventListener('submit', saveLateArrival);
                    form.dataset.bound = 'true';
                }
                    } else if (sectionId === 'visitorEntrySectionDiv') {
                loadVisitorCatalogs();
                loadVisitorGuards();
                resetVisitorForm();
            } else if (sectionId === 'dashboardSectionDiv') {
                console.log('📊 Iniciando sección dashboard...');
                
                // Mostrar mensaje de carga inmediatamente
                document.getElementById('dashPendingCount').textContent = '...';
                document.getElementById('dashConfirmedCount').textContent = '...';
                document.getElementById('dashTotalCount').textContent = '...';
                document.getElementById('dashRecentCount').textContent = '...';
                
                // Cargar dashboard con manejo de ECharts
                setTimeout(async () => {
                    try {
                        await loadDashboard();
                    } catch (error) {
                        console.error('❌ Error cargando dashboard desde showSection:', error);
                        showError('Error al cargar el dashboard. Usa el botón Debug para más información.');
                    }
                }, 100);
            }
            
            renewSession();
        }

        async function loadInitialData() {
            try {
                const role = currentUser?.rol?.nombre;
                    
                await loadReasons();
                
                if (role === 'talento_humano') {
                    await loadStaffMembers();
                } else {
                    await loadStudents();
                    await loadGrades();
                    if (role === 'administrador') {
                        await loadStaffMembers();
                    }
                }

                await loadRoles();
                
                if (role === 'administrador') {
                    await loadUsers();
                    await loadGuards();
                    await loadSecurityStats();
                }

                if (document.getElementById('visitorEntryForm')) {
                    await loadVisitorCatalogs();
                    await loadVisitorGuards();
                }
                    
                setupEventListeners();
                
            } catch (error) {
                console.error('Error al cargar datos iniciales:', error);
                await logSecurityEvent('error', 'Error al cargar datos iniciales', { 
                    error: error.message.substring(0, 200) 
                }, false);
            }
        }

        function setupEventListeners() {
            document.getElementById('authorizeForm').addEventListener('submit', authorizeExit);
            
            const staffForm = document.getElementById('staffAuthorizeForm');
            if (staffForm) {
                staffForm.addEventListener('submit', authorizeStaffExit);
            }

            const visitorForm = document.getElementById('visitorEntryForm');
            if (visitorForm) {
                visitorForm.addEventListener('submit', saveVisitorEntry);
            }

            const visitorResetBtn = document.getElementById('visitorResetBtn');
            if (visitorResetBtn) {
                visitorResetBtn.addEventListener('click', resetVisitorForm);
            }

            const visitorDocument = document.getElementById('visitorDocument');
            if (visitorDocument) {
                visitorDocument.addEventListener('blur', handleVisitorDocumentLookup);
                visitorDocument.addEventListener('change', handleVisitorDocumentLookup);
            }
                
            const staffHasReturn = document.getElementById('staffHasReturn');
            if (staffHasReturn) {
                staffHasReturn.addEventListener('change', () => {
                    toggleStaffReturnFields(staffHasReturn.checked);
                });
                toggleStaffReturnFields(staffHasReturn.checked);
            }  
                
            const studentSearchInput = document.getElementById('studentSearch');
            if (studentSearchInput) {
                studentSearchInput.addEventListener('input', () => {
                    validateSearchInput(studentSearchInput);
                });
            }
            
            document.getElementById('studentForm').addEventListener('submit', saveStudent);
            document.getElementById('userForm').addEventListener('submit', saveUser);
            document.getElementById('reasonForm').addEventListener('submit', saveReason);
            document.getElementById('gradeForm').addEventListener('submit', saveGrade);
            const guardForm = document.getElementById('guardForm');
            if (guardForm) {
                guardForm.addEventListener('submit', saveGuard);
            }
            const visitorProfileForm = document.getElementById('visitorProfileForm');
            if (visitorProfileForm) {
                visitorProfileForm.addEventListener('submit', saveVisitorProfile);
            }
            const visitorAreaForm = document.getElementById('visitorAreaForm');
            if (visitorAreaForm) {
                visitorAreaForm.addEventListener('submit', saveVisitorArea);
            }
            const visitorStatusForm = document.getElementById('visitorStatusForm');
            if (visitorStatusForm) {
                visitorStatusForm.addEventListener('submit', saveVisitorStatus);
            }

            const todayColombia = getColombiaDate();
            document.getElementById('exitDate').value = todayColombia;
            document.getElementById('historyDate').value = todayColombia;
            const staffExitDate = document.getElementById('staffExitDate');
            if (staffExitDate) {
                staffExitDate.value = todayColombia;
            }
            const visitorDate = document.getElementById('visitorDate');
            if (visitorDate) {
                visitorDate.value = todayColombia;
            }
             // document.getElementById('logDateFrom').value = todayColombia;
            // document.getElementById('logDateTo').value = todayColombia;
            
            console.log('📅 Fecha actual Colombia establecida:', todayColombia);
        }

        // ========================================
        // FUNCIONES DE CARGA DE DATOS (COPIADAS CON MEJORAS)
        // ========================================

        async function loadStudents() {
            try {
                if (!validateSession()) return;

                const { data: students, error } = await supabaseClient
                    .from('estudiantes')
                    .select(`
                        *,
                        grado:grados(nombre)
                    `)
                    .eq('activo', true)
                    .order('nombre');

                if (error) throw error;

                const select = document.getElementById('studentSelect');
                const gradeSelect = document.getElementById('studentGrade');
                
                select.innerHTML = '<option value="">Seleccionar estudiante...</option>';
                
                students.forEach(student => {
                    const option = document.createElement('option');
                    option.value = student.id;
                    option.textContent = sanitizeHtml(`${student.nombre} ${student.apellidos} - ${student.grado.nombre}`);
                    select.appendChild(option);
                });

                updateStudentsTable(students);
                
            } catch (error) {
                console.error('Error loading students:', error);
                await logSecurityEvent('error', 'Error al cargar estudiantes', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function loadStaffMembers() {
            try {
                if (!validateSession()) return;

                const { data: staff, error } = await supabaseClient
                    .from('personal_colegio')
                    .select('*')
                    .eq('activo', true)
                    .order('nombre');

                if (error) throw error;

                const select = document.getElementById('staffSelect');
                if (!select) return;

                select.innerHTML = '<option value="">Seleccionar colaborador...</option>';

                (staff || []).forEach(member => {
                    const option = document.createElement('option');
                    option.value = member.id;
                    const cedulaText = member.cedula ? ` - CC ${member.cedula}` : '';
                    option.textContent = `${member.nombre} (${member.cargo})${cedulaText}`;
                    select.appendChild(option);
                });

            } catch (error) {
                console.error('Error loading staff members:', error);
                await logSecurityEvent('error', 'Error al cargar personal', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function loadReasons() {
            try {
                if (!validateSession()) return;

                const { data: reasons, error } = await supabaseClient
                    .from('motivos')
                    .select('*')
                    .eq('activo', true)
                    .order('nombre');

                if (error) throw error;

                const select = document.getElementById('reasonSelect');
                if (select) {
                    select.innerHTML = '<option value="">Seleccionar motivo...</option>';

                    reasons.forEach(reason => {
                        const option = document.createElement('option');
                        option.value = reason.id;
                        option.textContent = sanitizeHtml(reason.nombre);
                        select.appendChild(option);
                    });
                }

                const staffReasonSelect = document.getElementById('staffReasonSelect');
                if (staffReasonSelect) {
                    staffReasonSelect.innerHTML = '<option value="">Seleccionar motivo...</option>';

                    reasons.forEach(reason => {
                        const option = document.createElement('option');
                        option.value = reason.id;
                        option.textContent = sanitizeHtml(reason.nombre);
                        staffReasonSelect.appendChild(option);
                    });
                }

                updateReasonsTable(reasons);
                
            } catch (error) {
                console.error('Error loading reasons:', error);
                await logSecurityEvent('error', 'Error al cargar motivos', { 
                    error: error.message.substring(0, 200) 
                }, false);
            }
        }

        // ========================================
        // FUNCIONES DE VISITANTES EXTERNOS
        // ========================================

        async function loadVisitorCatalogs() {
            await Promise.all([
                loadVisitorProfiles(),
                loadVisitorAreas(),
                loadVisitorStatuses()
            ]);
        }

        async function loadVisitorProfiles() {
            try {
                if (!validateSession()) return;

                const { data: profiles, error } = await supabaseClient
                    .from('perfiles_visitante')
                    .select('*')
                    .eq('activo', true)
                    .order('nombre');

                if (error) throw error;

                const select = document.getElementById('visitorProfileSelect');
                if (select) {
                    select.innerHTML = '<option value="">Selecciona el perfil del visitante</option>';
                    (profiles || []).forEach(profile => {
                        const option = document.createElement('option');
                        option.value = profile.id;
                        option.textContent = sanitizeHtml(profile.nombre);
                        select.appendChild(option);
                    });
                }

                if (currentUser?.rol?.nombre === 'administrador') {
                    updateVisitorProfilesTable(profiles || []);
                }
            } catch (error) {
                console.error('Error loading visitor profiles:', error);
                await logSecurityEvent('error', 'Error al cargar perfiles de visitantes', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function loadVisitorAreas() {
            try {
                if (!validateSession()) return;

                const { data: areas, error } = await supabaseClient
                    .from('areas_visitante')
                    .select('*')
                    .eq('activo', true)
                    .order('nombre');

                if (error) throw error;

                const select = document.getElementById('visitorAreaSelect');
                if (select) {
                    select.innerHTML = '<option value="">Buscar elementos</option>';
                    (areas || []).forEach(area => {
                        const option = document.createElement('option');
                        option.value = area.id;
                        option.textContent = sanitizeHtml(area.nombre);
                        select.appendChild(option);
                    });
                }

                if (currentUser?.rol?.nombre === 'administrador') {
                    updateVisitorAreasTable(areas || []);
                }
            } catch (error) {
                console.error('Error loading visitor areas:', error);
                await logSecurityEvent('error', 'Error al cargar áreas de visitantes', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function loadVisitorStatuses() {
            try {
                if (!validateSession()) return;

                const { data: statuses, error } = await supabaseClient
                    .from('estados_visitante')
                    .select('*')
                    .eq('activo', true)
                    .order('nombre');

                if (error) throw error;

                const select = document.getElementById('visitorStatusSelect');
                if (select) {
                    select.innerHTML = '<option value="">Buscar elementos</option>';
                    (statuses || []).forEach(status => {
                        const option = document.createElement('option');
                        option.value = status.id;
                        option.textContent = sanitizeHtml(status.nombre);
                        select.appendChild(option);
                    });
                }

                if (currentUser?.rol?.nombre === 'administrador') {
                    updateVisitorStatusesTable(statuses || []);
                }
            } catch (error) {
                console.error('Error loading visitor statuses:', error);
                await logSecurityEvent('error', 'Error al cargar estados de visitantes', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function loadVisitorGuards() {
            try {
                if (!validateSession()) return;

                const select = document.getElementById('visitorGuardSelect');
                if (!select) return;

                // Si hay un usuario actual, establecerlo automáticamente
                if (currentUser?.id) {
                    select.innerHTML = '';
                    const option = document.createElement('option');
                    option.value = currentUser.id;
                    option.textContent = sanitizeHtml(currentUser.nombre || 'Vigilante en turno');
                    select.appendChild(option);
                    select.value = currentUser.id;
                    select.disabled = true; // Deshabilitar el select para que no se pueda cambiar
                    return;
                }
                
                // Si por alguna razón no hay usuario actual, cargar todos los vigilantes
                const { data: users, error } = await supabaseClient
                    .from('usuarios')
                    .select('id, nombre, email, rol:roles(nombre)')
                    .eq('activo', true)
                    .order('nombre');

                if (error) throw error;

                const guards = (users || []).filter(user =>
                    user.rol?.nombre === 'vigilante' || user.email === 'vigilancia@colgemelli.edu.co'
                );

                select.disabled = false;
                select.innerHTML = '<option value="">Selecciona al vigilante</option>';
                guards.forEach(guard => {
                    const option = document.createElement('option');
                    option.value = guard.id;
                    option.textContent = sanitizeHtml(guard.nombre);
                    select.appendChild(option);
                });
            } catch (error) {
                console.error('Error loading visitor guards:', error);
                await logSecurityEvent('error', 'Error al cargar vigilantes', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function handleVisitorDocumentLookup() {
            const documentInput = document.getElementById('visitorDocument');
            const form = document.getElementById('visitorEntryForm');
            if (!documentInput || !form) return;

            const documento = documentInput.value.trim();
            if (!documento) {
                clearVisitorLookup();
                return;
            }

            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.', 'visitorError');
                    logout();
                    return;
                }

                const { data: visitor, error } = await supabaseClient
                    .from('visitantes')
                    .select('id, nombre, perfil_id')
                    .eq('documento', documento)
                    .maybeSingle();

                if (error) throw error;

                if (visitor) {
                    form.dataset.visitorId = visitor.id;
                    const nameInput = document.getElementById('visitorName');
                    const profileSelect = document.getElementById('visitorProfileSelect');
                    if (nameInput) nameInput.value = visitor.nombre || '';
                    if (profileSelect && visitor.perfil_id) profileSelect.value = visitor.perfil_id;

                    showSuccess('Visitante encontrado. Datos cargados.', 'visitorInfo');
                    await Promise.all([
                        loadVisitorHistory(visitor.id),
                        loadVisitorObservations(visitor.id)
                    ]);
                } else {
                    form.dataset.visitorId = '';
                    showWarning('Visitante nuevo. Completa los datos para registrarlo.', 'visitorError');
                    resetVisitorHistory();
                    resetVisitorObservations();
                }
            } catch (error) {
                console.error('Error searching visitor:', error);
                showError('Error al buscar el visitante: ' + error.message, 'visitorError');
                await logSecurityEvent('error', 'Error al buscar visitante', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function loadVisitorHistory(visitorId) {
            try {
                if (!validateSession()) return;
                if (!visitorId) {
                    resetVisitorHistory();
                    return;
                }

                const { data, error } = await supabaseClient
                    .from('ingresos_visitantes')
                    .select(`
                        id,
                        fecha,
                        hora,
                        motivo,
                        observaciones,
                        created_at,
                        area:areas_visitante(nombre),
                        estado:estados_visitante(nombre),
                        vigilante:usuarios(nombre)
                    `)
                    .eq('visitante_id', visitorId)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (error) throw error;

                renderVisitorHistory(data || []);
            } catch (error) {
                console.error('Error loading visitor history:', error);
                showError('Error al cargar el historial del visitante.', 'visitorError');
                await logSecurityEvent('error', 'Error al cargar historial de visitantes', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function loadVisitorObservations(visitorId) {
            try {
                if (!validateSession()) return;
                if (!visitorId) {
                    resetVisitorObservations();
                    return;
                }

                const { data, error } = await supabaseClient
                    .from('observaciones_visitante')
                    .select(`
                        id,
                        observacion,
                        created_at,
                        registrado_por:usuarios(nombre)
                    `)
                    .eq('visitante_id', visitorId)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (error) throw error;

                renderVisitorObservations(data || []);
            } catch (error) {
                console.error('Error loading visitor observations:', error);
                showError('Error al cargar observaciones del visitante.', 'visitorError');
                await logSecurityEvent('error', 'Error al cargar observaciones de visitantes', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        function renderVisitorHistory(records) {
            const list = document.getElementById('visitorHistoryList');
            if (!list) return;

            if (!records.length) {
                list.innerHTML = '<p style="color: #666;">No se encontraron ingresos previos.</p>';
                return;
            }

            list.innerHTML = records.map(record => {
                const dateText = formatDate(record.fecha);
                const timeText = record.hora ? ` - 🕒 ${formatTime(record.hora)}` : '';
                const areaText = record.area?.nombre ? sanitizeHtml(record.area.nombre) : 'Sin área';
                const statusText = record.estado?.nombre ? sanitizeHtml(record.estado.nombre) : 'Sin estado';
                const guardText = record.vigilante?.nombre ? sanitizeHtml(record.vigilante.nombre) : 'Sin vigilante';
                const motivoText = record.motivo ? sanitizeHtml(record.motivo) : 'Sin motivo';
                const obsText = record.observaciones ? sanitizeHtml(record.observaciones) : '';
                return `
                    <div class="visitor-entry">
                        <div class="visitor-entry-header">
                            <span>📅 ${dateText}${timeText}</span>
                            <span>${statusText}</span>
                        </div>
                        <div class="visitor-entry-meta"><strong>Área:</strong> ${areaText}</div>
                        <div class="visitor-entry-meta"><strong>Motivo:</strong> ${motivoText}</div>
                        <div class="visitor-entry-meta"><strong>Vigilante:</strong> ${guardText}</div>
                        ${obsText ? `<div class="visitor-entry-meta"><strong>Observaciones:</strong> ${obsText}</div>` : ''}
                    </div>
                `;
            }).join('');
        }

        function renderVisitorObservations(records) {
            const list = document.getElementById('visitorObservationList');
            if (!list) return;

            if (!records.length) {
                list.innerHTML = '<p style="color: #666;">No hay observaciones registradas.</p>';
                return;
            }

            list.innerHTML = records.map(record => {
                const dateText = formatDateTime(record.created_at);
                const author = record.registrado_por?.nombre ? sanitizeHtml(record.registrado_por.nombre) : 'Sin responsable';
                return `
                    <div class="visitor-observation">
                        <div class="visitor-entry-header">
                            <span>🗒️ ${sanitizeHtml(record.observacion)}</span>
                        </div>
                        <div class="visitor-entry-meta">📌 ${author} · ${dateText}</div>
                    </div>
                `;
            }).join('');
        }

        function resetVisitorHistory() {
            const list = document.getElementById('visitorHistoryList');
            if (list) {
                list.innerHTML = '<p style="color: #666;">No se encontraron ingresos previos.</p>';
            }
        }

        function resetVisitorObservations() {
            const list = document.getElementById('visitorObservationList');
            if (list) {
                list.innerHTML = '<p style="color: #666;">No hay observaciones registradas.</p>';
            }
        }

        function clearVisitorLookup() {
            const form = document.getElementById('visitorEntryForm');
            if (form) {
                form.dataset.visitorId = '';
            }
            resetVisitorHistory();
            resetVisitorObservations();
        }

        function resetVisitorForm() {
            const form = document.getElementById('visitorEntryForm');
            if (!form) return;

            form.reset();
            form.dataset.visitorId = '';
            const visitorDate = document.getElementById('visitorDate');
            if (visitorDate) visitorDate.value = getColombiaDate();

            // Establecer el vigilante actual automáticamente
            if (currentUser?.id) {
                const guardSelect = document.getElementById('visitorGuardSelect');
                if (guardSelect) {
                    guardSelect.value = currentUser.id;
                    guardSelect.disabled = true;
                }
            }
            resetVisitorHistory();
            resetVisitorObservations();
        }

        async function saveVisitorEntry(event) {
            event.preventDefault();

            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.', 'visitorError');
                    logout();
                    return;
                }

                const date = document.getElementById('visitorDate')?.value;
                const guardId = document.getElementById('visitorGuardSelect')?.value || currentUser?.id;
                const profileId = document.getElementById('visitorProfileSelect')?.value;
                const name = document.getElementById('visitorName')?.value.trim();
                const documentId = document.getElementById('visitorDocument')?.value.trim();
                const reason = document.getElementById('visitorReason')?.value.trim();
                const areaId = document.getElementById('visitorAreaSelect')?.value;
                const statusId = document.getElementById('visitorStatusSelect')?.value;
                const observations = document.getElementById('visitorObservations')?.value.trim();

                if (!date || !profileId || !name || !documentId || !reason || !areaId || !statusId) {
                    showError('Por favor, completa todos los campos obligatorios del registro del visitante.', 'visitorError');
                    return;
                }

                const { data: visitorData, error: visitorError } = await supabaseClient
                    .from('visitantes')
                    .upsert({
                        documento: documentId,
                        nombre: name,
                        perfil_id: profileId,
                        activo: true
                    }, { onConflict: 'documento' })
                    .select('id')
                    .single();

                if (visitorError) throw visitorError;

                const visitorId = visitorData?.id;
                if (!visitorId) {
                    throw new Error('No se pudo registrar el visitante.');
                }

                const { error: entryError } = await supabaseClient
                    .from('ingresos_visitantes')
                    .insert({
                        visitante_id: visitorId,
                        vigilante_id: guardId,
                        fecha: date,
                        hora: getColombiaTime(),
                        motivo: reason,
                        area_id: areaId,
                        estado_id: statusId,
                        observaciones: observations || null
                    });

                if (entryError) throw entryError;

                if (observations && currentUser?.id) {
                    const { error: obsError } = await supabaseClient
                        .from('observaciones_visitante')
                        .insert({
                            visitante_id: visitorId,
                            observacion: observations,
                            registrado_por: currentUser.id
                        });

                    if (obsError) throw obsError;
                }

                const form = document.getElementById('visitorEntryForm');
                if (form) {
                    form.dataset.visitorId = visitorId;
                }

                const reasonInput = document.getElementById('visitorReason');
                if (reasonInput) reasonInput.value = '';
                const observationsInput = document.getElementById('visitorObservations');
                if (observationsInput) observationsInput.value = '';

                showSuccess('Ingreso de visitante registrado correctamente.', 'visitorInfo');
                await Promise.all([
                    loadVisitorHistory(visitorId),
                    loadVisitorObservations(visitorId)
                ]);
            } catch (error) {
                console.error('Error saving visitor entry:', error);
                showError('Error al registrar el visitante: ' + error.message, 'visitorError');
                await logSecurityEvent('error', 'Error al registrar visitante', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function loadGrades() {
            try {
                if (!validateSession()) return;

                const { data: grades, error } = await supabaseClient
                    .from('grados')
                    .select('*')
                    .eq('activo', true)
                    .order('nombre');

                if (error) throw error;

                const gradeSelect = document.getElementById('gradeSelect');
                gradeSelect.innerHTML = '<option value="">Seleccionar grado...</option>';

                grades.forEach(grade => {
                    const option = document.createElement('option');
                    option.value = grade.id;
                    option.textContent = sanitizeHtml(`${grade.nombre} - ${grade.nivel}`);
                    gradeSelect.appendChild(option);
                });

                const lateGradeSelect = document.getElementById('lateGradeSelect');
                if (lateGradeSelect) {
                    lateGradeSelect.innerHTML = '<option value="">Seleccionar grado...</option>';
                    grades.forEach(grade => {
                        const option = document.createElement('option');
                        option.value = grade.id;
                        option.textContent = sanitizeHtml(`${grade.nombre} - ${grade.nivel}`);
                        lateGradeSelect.appendChild(option);
                    });
                }

                const studentGradeSelect = document.getElementById('studentGrade');
                if (studentGradeSelect) {
                    studentGradeSelect.innerHTML = '<option value="">Seleccionar grado...</option>';
                    
                    grades.forEach(grade => {
                        const option = document.createElement('option');
                        option.value = grade.id;
                        option.textContent = sanitizeHtml(`${grade.nombre} - ${grade.nivel}`);
                        studentGradeSelect.appendChild(option);
                    });
                }

                updateGradesTable(grades);
                console.log('✅ Grados cargados:', grades.length);
                
            } catch (error) {
                console.error('Error loading grades:', error);
                await logSecurityEvent('error', 'Error al cargar grados', { 
                    error: error.message.substring(0, 200) 
                }, false);
            }
        }

        async function loadRoles() {
            try {
                if (!validateSession()) return;

                const { data: roles, error } = await supabaseClient
                    .from('roles')
                    .select('*')
                    .order('nombre');

                if (error) throw error;

                rolesCache = roles || [];
                const select = document.getElementById('userRole');
                select.innerHTML = '<option value="">Seleccionar rol...</option>';
                
                rolesCache.forEach(role => {
                    const option = document.createElement('option');
                    option.value = role.id;
                    option.textContent = sanitizeHtml(role.descripcion);
                    select.appendChild(option);
                });
                
            } catch (error) {
                console.error('Error loading roles:', error);
                await logSecurityEvent('error', 'Error al cargar roles', { 
                    error: error.message.substring(0, 200) 
                }, false);
            }
        }

        function getRoleIdByName(roleName) {
            return rolesCache.find(role => role.nombre === roleName)?.id || null;
        }

        async function loadUsers() {
            try {
                if (!validateSession()) return;

                const { data: users, error } = await supabaseClient
                    .from('usuarios')
                    .select(`
                        *,
                        rol:roles(nombre, descripcion)
                    `)
                    .order('nombre');

                if (error) throw error;

                updateUsersTable(users);
                
            } catch (error) {
                console.error('Error loading users:', error);
                await logSecurityEvent('error', 'Error al cargar usuarios', { 
                    error: error.message.substring(0, 200) 
                }, false);
            }
        }

        async function loadGuards() {
            try {
                if (!validateSession()) return;

                const { data: users, error } = await supabaseClient
                    .from('usuarios')
                    .select(`
                        *,
                        rol:roles(nombre, descripcion)
                    `)
                    .eq('activo', true)
                    .order('nombre');

                if (error) throw error;

                const guardRoleId = getRoleIdByName('vigilante');
                const guards = (users || []).filter(user => {
                    if (guardRoleId) {
                        return user.rol_id === guardRoleId;
                    }
                    return user.rol?.nombre === 'vigilante';
                });

                updateGuardsTable(guards);
            } catch (error) {
                console.error('Error loading guards:', error);
                await logSecurityEvent('error', 'Error al cargar vigilantes', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        async function loadStudentsByGrade() {
            const gradeId = document.getElementById('gradeSelect').value;
            const studentSelect = document.getElementById('studentSelect');
            
            if (!gradeId) {
                studentSelect.innerHTML = '<option value="">Primero selecciona un grado...</option>';
                studentSelect.disabled = true;
                return;
            }
            
            try {
                if (!validateSession()) return;

                studentSelect.innerHTML = '<option value="">Cargando estudiantes...</option>';
                studentSelect.disabled = true;
                
                console.log('🔄 Cargando estudiantes del grado ID:', gradeId);
                
                const { data: students, error } = await supabaseClient
                    .from('estudiantes')
                    .select(`
                        id,
                        nombre,
                        apellidos,
                        documento
                    `)
                    .eq('grado_id', gradeId)
                    .eq('activo', true)
                    .order('apellidos')
                    .order('nombre');

                if (error) throw error;

                console.log('📊 Estudiantes encontrados:', students.length);

                studentSelect.innerHTML = '<option value="">Seleccionar estudiante...</option>';
                
                if (students && students.length > 0) {
                    students.forEach(student => {
                        const option = document.createElement('option');
                        option.value = student.id;
                        option.textContent = sanitizeHtml(`${student.apellidos}, ${student.nombre}${student.documento ? ' - Doc: ' + student.documento : ''}`);
                        studentSelect.appendChild(option);
                    });
                    
                    studentSelect.disabled = false;
                    console.log('✅ Select de estudiantes habilitado con', students.length, 'estudiantes');
                } else {
                    studentSelect.innerHTML = '<option value="">No hay estudiantes en este grado</option>';
                    console.log('⚠️ No se encontraron estudiantes para el grado seleccionado');
                }
                
            } catch (error) {
                console.error('❌ Error al cargar estudiantes por grado:', error);
                showError('Error al cargar los estudiantes: ' + error.message);
                studentSelect.innerHTML = '<option value="">Error al cargar estudiantes</option>';
                studentSelect.disabled = true;
                
                await logSecurityEvent('error', 'Error al cargar estudiantes por grado', { 
                    gradeId: gradeId,
                    error: error.message.substring(0, 200) 
                }, false);
            }
        }


         // ========================================
        // UTILIDADES PARA EDICIÓN DE AUTORIZACIONES
        // ========================================

        function isExitEditUser() {
            return currentUser && EXIT_EDIT_USERS.includes(currentUser.email);
        }

        function lockStudentSelection(lock) {
            const gradeSelect = document.getElementById('gradeSelect');
            const studentSelect = document.getElementById('studentSelect');
            const cancelBtn = document.getElementById('cancelEditExitBtn');

            if (gradeSelect) {
                gradeSelect.disabled = !!lock;
            }

            if (studentSelect) {
                if (lock) {
                    studentSelect.disabled = true;
                } else {
                    const shouldDisable = !gradeSelect || !gradeSelect.value;
                    studentSelect.disabled = shouldDisable;
                }
            }

            if (cancelBtn) {
                cancelBtn.style.display = lock ? 'inline-block' : 'none';
            }
        }

        function getOptionTextByValue(selectElement, value) {
            if (!selectElement || value === undefined || value === null) return null;
            const options = Array.from(selectElement.options || []);
            const match = options.find(option => option.value === String(value));
            return match ? match.text : null;
        }

        function cancelExitEdit() {
            resetAuthorizationForm();
            showSuccess('Edición cancelada. Puedes seleccionar otro estudiante.', 'loginInfo');
        }

        // ========================================
        // FUNCIONES DE AUTORIZACIÓN Y VERIFICACIÓN (COPIADAS CON MEJORAS)
        // ========================================

        async function authorizeExit(e) {
            e.preventDefault();
                
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }
                
                let gradeId = document.getElementById('gradeSelect').value;
                let studentId = document.getElementById('studentSelect').value;
                const reasonId = document.getElementById('reasonSelect').value;
                const exitDate = document.getElementById('exitDate').value;
                const exitTime = document.getElementById('exitTime').value;
                const observations = sanitizeHtml(document.getElementById('observations').value.trim());
                const exitEditUser = isExitEditUser();

                // Validaciones de seguridad
                if (!gradeId || !studentId || !reasonId || !exitDate || !exitTime) {
                    showError('Por favor, completa todos los campos obligatorios');
                    return;
                }

                // Validar fecha no sea pasada
                const todayColombia = getColombiaDate();
                if (exitDate < todayColombia) {
                    showError('No se puede autorizar una salida para una fecha pasada');
                    return;
                }

                // Validar observaciones
                if (observations && !validateText(observations)) {
                    showError('Las observaciones contienen caracteres no permitidos');
                    return;
                }

                 if (!currentExitAuthId) {
                    const { data: existing, error: existsError } = await supabaseClient
                        .from('autorizaciones_salida')
                        .select('id, motivo_id, fecha_salida, hora_salida, observaciones, usuario_autorizador_id')
                        .eq('estudiante_id', studentId)
                        .eq('fecha_salida', exitDate)
                        .eq('autorizada', true)
                        .is('salida_efectiva', null)
                        .limit(1);

                    if (existsError) throw existsError;
                    if (existing && existing.length > 0) {
                        const record = existing[0];
                        let reporter = 'otro usuario';
                        if (record.usuario_autorizador_id) {
                            const { data: userData, error: userError } = await supabaseClient
                                .from('usuarios')
                                .select('nombre')
                                .eq('id', record.usuario_autorizador_id)
                                .single();
                            if (!userError && userData) {
                                reporter = userData.nombre;
                            } else if (userError) {
                                console.error('Error obteniendo usuario autorizador:', userError.message);
                            }
                        }
                         const hora = record.hora_salida || 'hora desconocida';
                        const dupMessage = `El estudiante ya está registrado con salida pendiente a las ${sanitizeHtml(hora)} reportado por ${sanitizeHtml(reporter)}. Se cargaron los datos para editar.`;
                        showWarning(dupMessage);
                        sendNotification('Salida pendiente existente', dupMessage);
                        document.getElementById('reasonSelect').value = record.motivo_id;
                        document.getElementById('exitDate').value = record.fecha_salida;
                        document.getElementById('exitTime').value = record.hora_salida || '';
                        document.getElementById('observations').value = record.observaciones || '';
                         const reasonSelectElement = document.getElementById('reasonSelect');
                        currentExitOriginalData = {
                            motivo_id: record.motivo_id,
                            hora_salida: record.hora_salida,
                            observaciones: record.observaciones || '',
                            motivo_nombre: getOptionTextByValue(reasonSelectElement, record.motivo_id) || ''
                        };
                        currentExitAuthId = record.id;
                        currentExitLockedStudentId = studentId;
                        currentExitLockedGradeId = gradeId;
                        if (exitEditUser) {
                            lockStudentSelection(true);
                        } else {
                            lockStudentSelection(false);
                        }
                        return;
                    }
                }
                    
                 const colombiaDateTime = new Date().toLocaleString('sv-SE', {
                    timeZone: 'America/Bogota' 
                });
                
                 if (currentExitAuthId && exitEditUser) {
                    if (currentExitLockedGradeId) {
                        gradeId = currentExitLockedGradeId;
                    }
                    if (currentExitLockedStudentId) {
                        studentId = currentExitLockedStudentId;
                    }
                }

                let dbResult;
                if (currentExitAuthId) {
                    const updatePayload = {
                        motivo_id: reasonId,
                        fecha_salida: exitDate,
                        hora_salida: exitTime,
                        observaciones: observations || null,
                        usuario_autorizador_id: currentUser.id
                    };

                    if (exitEditUser) {
                        let originalData = currentExitOriginalData;

                        if (!originalData) {
                            const { data: fetchedRecord, error: fetchError } = await supabaseClient
                                .from('autorizaciones_salida')
                                .select('motivo_id, hora_salida, observaciones')
                                .eq('id', currentExitAuthId)
                                .single();

                            if (!fetchError && fetchedRecord) {
                                originalData = fetchedRecord;
                            } else if (fetchError) {
                                console.error('Error obteniendo autorización para comparar cambios:', fetchError.message);
                            }
                        }

                        if (originalData) {
                            const changes = [];
                            const reasonSelectElement = document.getElementById('reasonSelect');

                            const normalizeTimeValue = value => {
                                if (!value) return '';
                                return value.toString().substring(0, 5);
                            };
                            const describeTime = value => value ? `${value}` : 'Sin hora definida';

                            const previousTime = normalizeTimeValue(originalData.hora_salida);
                            const newTimeValue = normalizeTimeValue(exitTime);
                            if (previousTime !== newTimeValue) {
                                changes.push(`Hora modificada: ${describeTime(previousTime)} → ${describeTime(newTimeValue)}`);
                            }

                            const previousReasonId = originalData.motivo_id;
                            if (String(previousReasonId || '') !== String(reasonId)) {
                                const previousReasonName = originalData.motivo_nombre
                                    || getOptionTextByValue(reasonSelectElement, previousReasonId)
                                    || 'Motivo anterior no disponible';
                                const newReasonName = getOptionTextByValue(reasonSelectElement, reasonId)
                                    || 'Motivo actualizado';
                                changes.push(`Motivo modificado: ${previousReasonName} → ${newReasonName}`);
                            }

                            const normalizeObservation = value => (value || '').trim();
                            const summarizeObservation = value => {
                                if (!value) return 'Sin observación';
                                const cleaned = value.replace(/\s+/g, ' ').trim();
                                return cleaned.length > 120 ? `${cleaned.substring(0, 117)}...` : cleaned;
                            };

                            const previousObservation = normalizeObservation(originalData.observaciones);
                            const newObservation = normalizeObservation(observations);
                            if (previousObservation !== newObservation) {
                                changes.push(`Observación actualizada: ${summarizeObservation(previousObservation)} → ${summarizeObservation(newObservation)}`);
                            }

                            if (changes.length > 0) {
                                updatePayload.detalle_modificaciones = changes.join(' | ');
                                updatePayload.ultima_modificacion = colombiaDateTime;
                                updatePayload.usuario_modifico_id = currentUser.id;
                            }
                        }
                    }

                    dbResult = await supabaseClient
                        .from('autorizaciones_salida')
                            .update(updatePayload)
                        .eq('id', currentExitAuthId);
                } else {
                    dbResult = await supabaseClient
                        .from('autorizaciones_salida')
                        .insert([{ 
                            estudiante_id: studentId,
                            motivo_id: reasonId,
                            usuario_autorizador_id: currentUser.id,
                            fecha_salida: exitDate,
                            hora_salida: exitTime,
                            observaciones: observations || null,
                            fecha_creacion: colombiaDateTime,
                            autorizada: true
                        }]);
                }

                const { data, error } = dbResult;

                if (error) throw error;

                const gradeSelect = document.getElementById('gradeSelect');
                const studentSelect = document.getElementById('studentSelect');
                 let gradeName = gradeSelect?.options?.[gradeSelect.selectedIndex]?.text || '';
                let studentName = studentSelect?.options?.[studentSelect.selectedIndex]?.text || '';

                if (currentExitAuthId && exitEditUser) {
                    const lockedGradeName = getOptionTextByValue(gradeSelect, currentExitLockedGradeId);
                    const lockedStudentName = getOptionTextByValue(studentSelect, currentExitLockedStudentId);
                    if (lockedGradeName) gradeName = lockedGradeName;
                    if (lockedStudentName) studentName = lockedStudentName;
                }

                  if (currentExitAuthId) {
                    await logSecurityEvent('update', 'Autorización de salida actualizada', {
                        authId: currentExitAuthId,
                        studentId,
                        gradeId,
                        reasonId,
                        exitDate,
                        exitTime
                    }, true);

                    showSuccess(`✅ Autorización actualizada exitosamente para ${sanitizeHtml(studentName)} (${sanitizeHtml(gradeName)})`);
                    console.log(`✅ Autorización actualizada: ${studentName} - ${gradeName} - ${exitDate} ${exitTime}`);
                } else {
                    await logSecurityEvent('create', 'Autorización de salida creada', {
                        studentId,
                        gradeId,
                        reasonId,
                        exitDate,
                        exitTime
                    }, true);

                    showSuccess(`✅ Autorización creada exitosamente para ${sanitizeHtml(studentName)} (${sanitizeHtml(gradeName)})`);
                    console.log(`✅ Autorización creada: ${studentName} - ${gradeName} - ${exitDate} ${exitTime}`);
                }

                sendNotification(studentName, gradeName);
                resetAuthorizationForm();
                

                
            } catch (error) {
                await logSecurityEvent('error', 'Error al guardar autorización', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al guardar la autorización: ' + error.message);
            }
        }

         async function authorizeStaffExit(e) {
            e.preventDefault();

            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const staffId = document.getElementById('staffSelect').value;
                const reasonId = document.getElementById('staffReasonSelect').value;
                const exitDate = document.getElementById('staffExitDate').value;
                const exitTime = document.getElementById('staffExitTime').value;
                const observations = sanitizeHtml(document.getElementById('staffObservations').value.trim());
                const hasReturn = document.getElementById('staffHasReturn')?.checked || false;
                const returnTime = document.getElementById('staffReturnTime')?.value || '';

                if (!staffId || !reasonId || !exitDate) {
                    showError('Por favor, completa los campos obligatorios del registro del personal.');
                    return;
                }

                 if (hasReturn && !returnTime) {
                    showError('Por favor, indica la hora estimada de regreso del colaborador.');
                    return;
                }
                    
                const todayColombia = getColombiaDate();
                if (exitDate < todayColombia) {
                    showError('No se puede autorizar un registro para una fecha pasada');
                    return;
                }

                const { data: existingAuths, error: existingError } = await supabaseClient
                    .from('autorizaciones_personal')
                    .select('id, motivo_id, hora_salida, fecha_salida, observaciones, usuario_autorizador_id, requiere_regreso, hora_regreso_estimada')
                    .eq('colaborador_id', staffId)
                    .eq('fecha_salida', exitDate)
                    .is('salida_efectiva', null)
                    .order('fecha_creacion', { ascending: false })
                    .limit(1);

                if (existingError) throw existingError;

                if (existingAuths && existingAuths.length > 0) {
                    const record = existingAuths[0];
                    const { data: userInfo } = await supabaseClient
                        .from('usuarios')
                        .select('nombre')
                        .eq('id', record.usuario_autorizador_id)
                        .single();

                    const message = `El colaborador ya tiene un registro pendiente a las ${formatTime(record.hora_salida)}. Autorizado por ${userInfo?.nombre || 'usuario'}. Se cargaron los datos para editar.`;
                    showWarning(message);
                    sendNotification('Salida pendiente existente', message);

                    document.getElementById('staffReasonSelect').value = record.motivo_id || '';
                    document.getElementById('staffExitDate').value = record.fecha_salida;
                    document.getElementById('staffExitTime').value = record.hora_salida || '';
                    document.getElementById('staffObservations').value = record.observaciones || '';
                    toggleStaffReturnFields(!!record.requiere_regreso);
                    document.getElementById('staffReturnTime').value = record.hora_regreso_estimada || '';
                    currentStaffAuthId = record.id;
                    return;
                }

                const colombiaDateTime = getColombiaDateTime();

                let dbAction;
                if (currentStaffAuthId) {
                    dbAction = supabaseClient
                        .from('autorizaciones_personal')
                        .update({
                            motivo_id: reasonId,
                            fecha_salida: exitDate,
                            hora_salida: exitTime || null,
                            observaciones: observations || null,
                            usuario_autorizador_id: currentUser.id,
                            requiere_regreso: hasReturn,
                            hora_regreso_estimada: hasReturn ? returnTime : null
                        })
                        .eq('id', currentStaffAuthId);
                } else {
                    dbAction = supabaseClient
                        .from('autorizaciones_personal')
                        .insert([{
                            colaborador_id: staffId,
                            motivo_id: reasonId,
                            usuario_autorizador_id: currentUser.id,
                            fecha_salida: exitDate,
                            hora_salida: exitTime || null,
                            requiere_regreso: hasReturn,
                            hora_regreso_estimada: hasReturn ? returnTime : null,
                            observaciones: observations || null,
                            fecha_creacion: colombiaDateTime,
                            autorizada: true
                        }]);
                }

                const { error } = await dbAction;
                if (error) throw error;

                const staffSelect = document.getElementById('staffSelect');
                const staffName = staffSelect.options[staffSelect.selectedIndex]?.text || 'Colaborador';
                const reasonSelect = document.getElementById('staffReasonSelect');
                const reasonName = reasonSelect.options[reasonSelect.selectedIndex]?.text || '';

                if (currentStaffAuthId) {
                    await logSecurityEvent('update', 'Autorización de salida de personal actualizada', {
                        authId: currentStaffAuthId,
                        staffId,
                        reasonId,
                        exitDate,
                         exitTime,
                        requiresReturn: hasReturn,
                        returnTime: hasReturn ? returnTime : null
                    }, true);

                    showSuccess(`✅ Autorización actualizada para ${staffName}`);
                } else {
                    await logSecurityEvent('create', 'Autorización de salida de personal creada', {
                        staffId,
                        reasonId,
                        exitDate,
                        exitTime,
                        requiresReturn: hasReturn,
                        returnTime: hasReturn ? returnTime : null
                    }, true);

                    showSuccess(`✅ Autorización creada para ${staffName}`);
                }

                sendNotification('Salida autorizada', `${staffName} - ${reasonName}`);
                resetStaffAuthorizationForm();
                await loadPendingStaffExits();

            } catch (error) {
                await logSecurityEvent('error', 'Error al guardar autorización de personal', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al guardar la autorización: ' + error.message);
            }
        }

        function resetAuthorizationForm() {
            document.getElementById('authorizeForm').reset();
                
            const studentSelect = document.getElementById('studentSelect');
            if (studentSelect) {
                studentSelect.innerHTML = '<option value="">Primero selecciona un grado...</option>';
            }

            lockStudentSelection(false);
                
            const todayColombia = getColombiaDate();
            document.getElementById('exitDate').value = todayColombia;
            currentExitAuthId = null;
            currentExitLockedStudentId = null;
            currentExitLockedGradeId = null;
            currentExitOriginalData = null;
        }

        function resetStaffAuthorizationForm() {
            const form = document.getElementById('staffAuthorizeForm');
            if (!form) return;

            form.reset();
            const todayColombia = getColombiaDate();
            document.getElementById('staffExitDate').value = todayColombia;
            toggleStaffReturnFields(false);
            currentStaffAuthId = null;
        }

        function toggleStaffReturnFields(forceValue) {
            const checkbox = document.getElementById('staffHasReturn');
            const returnGroup = document.getElementById('staffReturnTimeGroup');
            const returnInput = document.getElementById('staffReturnTime');

            const shouldShow = typeof forceValue === 'boolean'
                ? forceValue
                : (checkbox ? checkbox.checked : false);

            if (checkbox && typeof forceValue === 'boolean') {
                checkbox.checked = forceValue;
            }

            if (returnGroup) {
                returnGroup.style.display = shouldShow ? 'block' : 'none';
            }

            if (!shouldShow && returnInput) {
                returnInput.value = '';
            }
        }

        async function searchStudent() {
            const searchTerm = sanitizeHtml(document.getElementById('studentSearch').value.trim());
            const resultDiv = document.getElementById('searchResult');
            
            if (searchTerm.length < 3) {
                resultDiv.innerHTML = '<div class="card"><p style="text-align: center; color: #666;">Escribe al menos 3 caracteres para buscar...</p></div>';
                return;
            }

            // Validar entrada de búsqueda
            if (!validateText(searchTerm)) {
                resultDiv.innerHTML = '<div class="verification-card not-authorized"><h3>❌ BÚSQUEDA INVÁLIDA</h3><p>La búsqueda contiene caracteres no permitidos.</p></div>';
                return;
            }

            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const todayColombia = getColombiaDate();
                
                console.log('🔍 Buscando autorizaciones para:', searchTerm.substring(0, 10) + '...', 'en fecha Colombia:', todayColombia);
                
                const { data: authorizations, error } = await supabaseClient
                    .from('autorizaciones_salida')
                    .select('*')
                    .eq('fecha_salida', todayColombia)
                    .eq('autorizada', true);

                if (error) {
                    console.error('Error en búsqueda:', error);
                    showError('Error al buscar autorizaciones: ' + error.message);
                    return;
                }

                if (!authorizations || authorizations.length === 0) {
                    resultDiv.innerHTML = `
                        <div class="verification-card not-authorized">
                            <h3>❌ NO HAY AUTORIZACIONES</h3>
                            <p>No se encontraron autorizaciones para la fecha de hoy (${formatDate(todayColombia)}).</p>
                        </div>
                    `;
                    return;
                }

                const { data: students, error: studentsError } = await supabaseClient
                    .from('estudiantes')
                    .select('id, nombre, apellidos, grado:grados(nombre)')
                    .or(`nombre.ilike.%${searchTerm}%,apellidos.ilike.%${searchTerm}%`)
                    .eq('activo', true);

                if (studentsError) {
                    console.error('Error buscando estudiantes:', studentsError);
                    resultDiv.innerHTML = `
                        <div class="verification-card not-authorized">
                            <h3>❌ ERROR EN BÚSQUEDA</h3>
                            <p>Error al buscar estudiantes: ${studentsError.message}</p>
                        </div>
                    `;
                    return;
                }

                const studentIds = students?.map(s => s.id) || [];
                const matchingAuth = authorizations.filter(auth => 
                    studentIds.includes(auth.estudiante_id)
                );

                if (matchingAuth.length === 0) {
                    let studentsList = students?.map(s => `${sanitizeHtml(s.nombre)} ${sanitizeHtml(s.apellidos)} (${sanitizeHtml(s.grado.nombre)})`).join(', ') || '';
                    resultDiv.innerHTML = `
                        <div class="verification-card not-authorized">
                            <h3>❌ NO AUTORIZADO</h3>
                            <p>No se encontraron autorizaciones para "${sanitizeHtml(searchTerm)}" en la fecha de hoy (${formatDate(todayColombia)}).</p>
                            ${studentsList ? `<p><strong>Estudiantes encontrados:</strong> ${studentsList}</p>` : ''}
                            <p><em>Verifica que tengan autorización para hoy o contacta al personal autorizado.</em></p>
                        </div>
                    `;
                    return;
                }

                const reasonIds = [...new Set(matchingAuth.map(auth => auth.motivo_id))];
                const userIds = [...new Set(matchingAuth
                    .flatMap(auth => [auth.usuario_autorizador_id, auth.usuario_modifico_id])
                    .filter(Boolean))];

                const [reasonsResult, usersResult] = await Promise.all([
                    supabaseClient.from('motivos').select('id, nombre').in('id', reasonIds),
                    supabaseClient.from('usuarios').select('id, nombre, email').in('id', userIds)
                ]);

                const studentMap = {};
                const reasonMap = {};
                const userMap = {};

                students?.forEach(student => {
                    studentMap[student.id] = student;
                });

                reasonsResult.data?.forEach(reason => {
                    reasonMap[reason.id] = reason;
                });

                usersResult.data?.forEach(user => {
                    userMap[user.id] = user;
                });

                const currentTime = getColombiaTime();
                let html = `<div style="text-align: center; margin-bottom: 20px; background: rgba(52, 152, 219, 0.1); padding: 15px; border-radius: 5px;">
                    <p style="color: #2c3e50; font-size: 15px; font-weight: bold;">📅 ${formatDate(todayColombia)} - 🕐 ${currentTime} (Hora Colombia)</p>
                </div>`;
                
                matchingAuth.forEach(auth => {
                    const student = studentMap[auth.estudiante_id];
                    const reason = reasonMap[auth.motivo_id];
                    const user = userMap[auth.usuario_autorizador_id];
                    const modifier = auth.usuario_modifico_id ? userMap[auth.usuario_modifico_id] : null;
                    const modificationDate = auth.ultima_modificacion ? sanitizeHtml(formatDateTime(auth.ultima_modificacion)) : '';
                    const modificationHtml = auth.detalle_modificaciones ? `
                        <div class="verification-card-update">
                            <strong>🔄 Cambios recientes${modifier ? ` por ${sanitizeHtml(modifier.nombre)}` : ''}</strong>
                            <span class="change-details">${sanitizeHtml(auth.detalle_modificaciones)}</span>
                            ${modificationDate ? `<small>Actualizado el ${modificationDate}</small>` : ''}
                        </div>
                    ` : '';

                    let cardClass, titleText, footerHtml;
                    
                    if (auth.salida_efectiva) {
                        cardClass = 'verified';
                        titleText = '✅ SALIDA YA CONFIRMADA';
                        footerHtml = `
                            <div class="verification-card-footer">
                                <p><strong>✅ Autorizado por:</strong> ${user?.nombre ? sanitizeHtml(user.nombre) : 'No encontrado'}</p>
                                ${auth.observaciones ? `
                                    <div class="verification-card-obs">
                                        <strong>📝 Observaciones:</strong><br>
                                        ${sanitizeHtml(auth.observaciones)}
                                    </div>
                                ` : ''}
                                ${modificationHtml}
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-top: 15px;">
                                    <p style="color: white; font-weight: bold; margin: 0;">
                                        ✅ CONFIRMADA: ${formatDateTime(auth.salida_efectiva)}<br>
                                        <small>Vigilante: ${sanitizeHtml(currentUser.nombre)}</small>
                                    </p>
                                </div>
                            </div>
                        `;
                    } else {
                        cardClass = 'authorized';
                         const authEmail = (user?.email || '').toLowerCase();
                        if (authEmail === 'enfermeria@colgemelli.edu.co') {
                            cardClass = 'authorized-enfermeria';
                        } else if (authEmail === 'convivencia@colgemelli.edu.co') {
                            cardClass = 'authorized-convivencia';
                        } else if (authEmail === 'gformativa@colgemelli.edu.co') {
                            cardClass = 'authorized-formativa';
                        }
                        titleText = '✅ AUTORIZADO PARA SALIR';
                        footerHtml = `
                            <div class="verification-card-footer">
                                <p><strong>✅ Autorizado por:</strong> ${user?.nombre ? sanitizeHtml(user.nombre) : 'No encontrado'}</p>
                                ${auth.observaciones ? `
                                    <div class="verification-card-obs">
                                        <strong>📝 Observaciones:</strong><br>
                                        ${sanitizeHtml(auth.observaciones)}
                                    </div>
                                ` : ''}
                                ${modificationHtml}
                                <button class="btn btn-success" onclick="confirmExit(${auth.id})" style="font-size: 18px; padding: 15px 40px; margin-top: 15px;">
                                    ✅ CONFIRMAR SALIDA
                                </button>
                            </div>
                        `;
                    }

                    html += `
                        <div class="verification-card ${cardClass}">
                            <h3>${titleText}</h3>
                            
                            <div class="verification-card-content">
                                <div class="verification-card-info">
                                    <p>
                                        <strong>👨‍🎓 Estudiante:</strong>
                                        <span class="info-value">${student ? `${sanitizeHtml(student.nombre)} ${sanitizeHtml(student.apellidos)}` : 'No encontrado'}</span>
                                    </p>
                                    <p>
                                        <strong>🎓 Grado:</strong>
                                        <span class="info-value">${student?.grado?.nombre ? sanitizeHtml(student.grado.nombre) : 'No encontrado'}</span>
                                    </p>
                                </div>
                                <div class="verification-card-info">
                                    <p>
                                        <strong>📝 Motivo de Salida:</strong>
                                        <span class="info-value">${reason?.nombre ? sanitizeHtml(reason.nombre) : 'No encontrado'}</span>
                                    </p>
                                    <p>
                                        <strong>🕐 Hora Autorizada:</strong>
                                        <span class="info-value">${formatTime(auth.hora_salida)}</span>
                                    </p>
                                </div>
                            </div>
                            
                            ${footerHtml}
                        </div>
                    `;
                });

                resultDiv.innerHTML = html;
                
            } catch (error) {
                console.error('Error general en búsqueda:', error);
                await logSecurityEvent('error', 'Error en búsqueda de estudiante', { 
                    searchTerm: searchTerm.substring(0, 20) + '...',
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al buscar autorizaciones: ' + error.message);
                resultDiv.innerHTML = `
                    <div class="verification-card not-authorized">
                        <h3>❌ ERROR</h3>
                        <p>Error en la búsqueda: ${error.message}</p>
                    </div>
                `;
            }
        }

        async function loadPendingExits() {
            const pendingList = document.getElementById('pendingExitsList');
                
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                pendingList.innerHTML = '<div class="card" style="text-align: center; padding: 20px;"><p style="color: #666;">🔄 Cargando salidas pendientes...</p></div>';
                
                const todayColombia = getColombiaDate();
                console.log('📅 Cargando salidas pendientes para Colombia:', todayColombia);
                
                const { data: authorizations, error } = await supabaseClient
                    .from('autorizaciones_salida')
                    .select('*')
                    .eq('fecha_salida', todayColombia)
                    .eq('autorizada', true)
                    .is('salida_efectiva', null)
                    .order('hora_salida', { ascending: true });

                if (error) {
                    console.error('❌ Error al cargar salidas pendientes:', error);
                    throw error;
                }

                if (!authorizations || authorizations.length === 0) {
                    const currentTime = getColombiaTime();
                    pendingList.innerHTML = `
                        <div class="verification-card" style="background: linear-gradient(135deg, #95a5a6, #7f8c8d);">
                            <h3>✅ ¡Todo en orden!</h3>
                            <p><strong>No hay salidas pendientes para hoy</strong></p>
                            <p>Fecha: ${formatDate(todayColombia)} - Hora: ${currentTime}</p>
                            <p>Todos los estudiantes autorizados ya han sido confirmados</p>
                        </div>
                    `;
                    return;
                }

                console.log('📊 Salidas pendientes encontradas:', authorizations.length);

                const studentIds = [...new Set(authorizations.map(auth => auth.estudiante_id))];
                const reasonIds = [...new Set(authorizations.map(auth => auth.motivo_id))];
                const userIds = [...new Set(authorizations
                    .flatMap(auth => [auth.usuario_autorizador_id, auth.usuario_modifico_id])
                    .filter(Boolean))];

                const [studentsResult, reasonsResult, usersResult] = await Promise.all([
                    supabaseClient
                        .from('estudiantes')
                        .select('id, nombre, apellidos, grado:grados(nombre), foto_url')
                        .in('id', studentIds),
                    supabaseClient
                        .from('motivos')
                        .select('id, nombre')
                        .in('id', reasonIds),
                    supabaseClient
                        .from('usuarios')
                        .select('id, nombre, email')
                        .in('id', userIds)
                ]);

                const studentMap = {};
                const reasonMap = {};
                const userMap = {};

                studentsResult.data?.forEach(student => {
                    studentMap[student.id] = student;
                });

                reasonsResult.data?.forEach(reason => {
                    reasonMap[reason.id] = reason;
                });

                usersResult.data?.forEach(user => {
                    userMap[user.id] = user;
                });

                const currentTime = getColombiaTime();
                let html = `<div style="text-align: center; margin-bottom: 25px; background: rgba(52, 152, 219, 0.1); padding: 20px; border-radius: 10px;">
                    <p style="color: #2c3e50; font-weight: bold; font-size: 16px;">📅 ${formatDate(todayColombia)} - 🕐 ${currentTime} (Hora Colombia)</p>
                    <p style="color: #7f8c8d; margin-top: 8px;">Salidas pendientes de confirmación: <strong>${authorizations.length}</strong></p>
                </div>`;
                
                authorizations.forEach(auth => {
                    const student = studentMap[auth.estudiante_id];
                    const reason = reasonMap[auth.motivo_id];
                    const user = userMap[auth.usuario_autorizador_id];
                    const modifier = auth.usuario_modifico_id ? userMap[auth.usuario_modifico_id] : null;
                    const modificationDate = auth.ultima_modificacion ? sanitizeHtml(formatDateTime(auth.ultima_modificacion)) : '';
                    const modificationHtml = auth.detalle_modificaciones ? `
                        <div class="verification-card-update">
                            <strong>🔄 Cambios recientes${modifier ? ` por ${sanitizeHtml(modifier.nombre)}` : ''}</strong>
                            <span class="change-details">${sanitizeHtml(auth.detalle_modificaciones)}</span>
                            ${modificationDate ? `<small>Actualizado el ${modificationDate}</small>` : ''}
                        </div>
                    ` : '';

                     let cardClass = 'authorized';
                    const authEmail = (user?.email || '').toLowerCase();
                    if (authEmail === 'enfermeria@colgemelli.edu.co') {
                        cardClass = 'authorized-enfermeria';
                    } else if (authEmail === 'convivencia@colgemelli.edu.co') {
                        cardClass = 'authorized-convivencia';
                    } else if (authEmail === 'gformativa@colgemelli.edu.co') {
                        cardClass = 'authorized-formativa';
                    }
                    
                    html += `
                        <div class="verification-card ${cardClass}">
                            <h3>⏳ PENDIENTE CONFIRMAR SALIDA</h3>
                            <img src="${student?.foto_url || 'https://via.placeholder.com/120'}" alt="Foto estudiante" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 2px solid #fff; margin-bottom: 10px;">
                            
                            <div class="verification-card-content">
                                <div class="verification-card-info">
                                    <p>
                                        <strong>👨‍🎓 Estudiante:</strong>
                                        <span class="info-value">${student ? sanitizeHtml(`${student.nombre} ${student.apellidos}`) : 'No encontrado'}</span>
                                    </p>
                                    <p>
                                        <strong>🎓 Grado:</strong>
                                        <span class="info-value">${student?.grado?.nombre ? sanitizeHtml(student.grado.nombre) : 'No encontrado'}</span>
                                    </p>
                                </div>
                                <div class="verification-card-info">
                                    <p>
                                        <strong>📝 Motivo de Salida:</strong>
                                        <span class="info-value">${reason?.nombre ? sanitizeHtml(reason.nombre) : 'No encontrado'}</span>
                                    </p>
                                    <p>
                                        <strong>🕐 Hora Autorizada:</strong>
                                        <span class="info-value">${formatTime(auth.hora_salida)}</span>
                                    </p>
                                </div>
                            </div>
                            
                            <div class="verification-card-footer">
                                <p><strong>✅ Autorizado por:</strong> ${user?.nombre ? sanitizeHtml(user.nombre) : 'No encontrado'}</p>
                                ${auth.observaciones ? `
                                    <div class="verification-card-obs">
                                        <strong>📝 Observaciones:</strong><br>
                                        ${sanitizeHtml(auth.observaciones)}
                                    </div>
                                ` : ''}
                                ${modificationHtml}
                                <button class="btn btn-success" onclick="confirmExit(${auth.id})" style="font-size: 18px; padding: 15px 40px; margin-top: 15px;">
                                    ✅ CONFIRMAR SALIDA
                                </button>
                            </div>
                        </div>
                    `;
                });

                pendingList.innerHTML = html;
                console.log('✅ Lista de salidas pendientes cargada');

            } catch (error) {
                console.error('❌ Error general:', error);
                await logSecurityEvent('error', 'Error al cargar salidas pendientes', { 
                    error: error.message.substring(0, 200) 
                }, false);
                pendingList.innerHTML = `
                    <div class="verification-card not-authorized">
                        <h3>❌ Error al cargar</h3>
                        <p>No se pudieron cargar las salidas pendientes</p>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <button class="btn btn-secondary" onclick="loadPendingExits()" style="margin-top: 10px;">
                            🔄 Intentar de nuevo
                        </button>
                    </div>
                `;
            }
        }

        async function loadPendingStaffExits() {
            const pendingList = document.getElementById('pendingStaffList');
            if (!pendingList) return;

            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                pendingList.innerHTML = '<div class="card" style="text-align: center; padding: 20px;"><p style="color: #666;">🔄 Cargando salidas del personal...</p></div>';

                const todayColombia = getColombiaDate();

                const { data: authorizations, error } = await supabaseClient
                    .from('autorizaciones_personal')
                    .select('*')
                    .eq('fecha_salida', todayColombia)
                    .eq('autorizada', true)
                    .or('salida_efectiva.is.null,and(requiere_regreso.eq.true,regreso_efectivo.is.null)')
                    .order('hora_salida', { ascending: true });

                if (error) throw error;

                 const records = authorizations || [];
                const pendingExitAuths = records.filter(auth => !auth.salida_efectiva);
                const pendingReturnAuths = records.filter(auth => auth.salida_efectiva && auth.requiere_regreso && !auth.regreso_efectivo);

                if (pendingExitAuths.length === 0 && pendingReturnAuths.length === 0) {
                    pendingList.innerHTML = `
                        <div class="verification-card staff-card" style="background: #C69C72;">
                            <h3>✅ Sin pendientes del personal</h3>
                            <p><strong>No hay salidas ni regresos por confirmar hoy (${formatDate(todayColombia)})</strong></p>
                        </div>
                    `;
                    return;
                }

                const relevantAuths = [...pendingExitAuths, ...pendingReturnAuths];
                const staffIds = [...new Set(relevantAuths.map(auth => auth.colaborador_id))];
                const reasonIds = [...new Set(relevantAuths.map(auth => auth.motivo_id).filter(Boolean))];
                const userIds = [...new Set(relevantAuths.map(auth => auth.usuario_autorizador_id))];

                const [staffResult, reasonsResult, usersResult] = await Promise.all([
                    supabaseClient
                        .from('personal_colegio')
                        .select('id, nombre, cargo, cedula')
                        .in('id', staffIds),
                    reasonIds.length > 0
                        ? supabaseClient.from('motivos').select('id, nombre').in('id', reasonIds)
                        : Promise.resolve({ data: [] }),
                    supabaseClient
                        .from('usuarios')
                        .select('id, nombre, email')
                        .in('id', userIds)
                ]);

                const staffMap = {};
                const reasonMap = {};
                const userMap = {};

                staffResult.data?.forEach(member => {
                    staffMap[member.id] = member;
                });

                reasonsResult.data?.forEach(reason => {
                    reasonMap[reason.id] = reason;
                });

                usersResult.data?.forEach(user => {
                    userMap[user.id] = user;
                });

                const currentTime = getColombiaTime();
                const totalPending = pendingExitAuths.length + pendingReturnAuths.length;
                let html = `<div style="text-align: center; margin-bottom: 25px; background: rgba(198, 156, 114, 0.25); padding: 20px; border-radius: 10px;">
                    <p style="color: #2c3e50; font-weight: bold; font-size: 16px;">📅 ${formatDate(todayColombia)} - 🕐 ${currentTime} (Hora Colombia)</p>
                    <p style="color: #7f8c8d; margin-top: 8px;">Gestiones pendientes del personal: <strong>${totalPending}</strong> (Salidas: ${pendingExitAuths.length} • Regresos: ${pendingReturnAuths.length})</p>
                </div>`;

                if (pendingExitAuths.length > 0) {
                    html += '<h4 style="color: #2c3e50; margin: 25px 0 15px 0;">🚶‍♀️ Salidas por confirmar</h4>';
                    pendingExitAuths.forEach(auth => {
                        const staff = staffMap[auth.colaborador_id];
                        const reason = reasonMap[auth.motivo_id];
                        const user = userMap[auth.usuario_autorizador_id];
                        const expectedReturn = auth.requiere_regreso
                            ? (auth.hora_regreso_estimada ? formatTime(auth.hora_regreso_estimada) : 'Sin hora definida')
                            : null;

                        html += `
                            <div class="verification-card staff-card" data-auth-id="${auth.id}" data-card-type="exit">
                                <h3>⏳ PENDIENTE CONFIRMAR SALIDA</h3>
                                <div class="verification-card-content">
                                    <div class="verification-card-info">
                                        <p><strong>👥 Colaborador:</strong> <span class="info-value">${staff ? sanitizeHtml(staff.nombre) : 'No encontrado'}</span></p>
                                        <p><strong>💼 Cargo:</strong> <span class="info-value">${staff?.cargo ? sanitizeHtml(staff.cargo) : 'No registrado'}</span></p>
                                    </div>
                                    <div class="verification-card-info">
                                        <p><strong>🧾 Cédula:</strong> <span class="info-value">${staff?.cedula ? sanitizeHtml(staff.cedula) : 'N/A'}</span></p>
                                        <p><strong>🕐 Hora Autorizada:</strong> <span class="info-value">${formatTime(auth.hora_salida)}</span></p>
                                        ${auth.requiere_regreso ? `<p><strong>🔁 Hora de regreso:</strong> <span class="info-value">${sanitizeHtml(expectedReturn)}</span></p>` : ''}
                                    </div>
                                </div>
                                 <div class="verification-card-footer">
                                    <p><strong>✅ Autorizado por:</strong> ${user?.nombre ? sanitizeHtml(user.nombre) : 'No encontrado'}</p>
                                    ${reason?.nombre ? `<p><strong>📝 Motivo:</strong> ${sanitizeHtml(reason.nombre)}</p>` : ''}
                                    ${auth.observaciones ? `<div class="verification-card-obs"><strong>📝 Observaciones:</strong><br>${sanitizeHtml(auth.observaciones)}</div>` : ''}
                                    ${auth.requiere_regreso ? `<p style="margin-top: 10px; font-weight: 600;">🔁 Se debe registrar el regreso cuando vuelva el colaborador.</p>` : ''}
                                    <button class="btn btn-success" onclick="confirmStaffExit(${auth.id})" style="font-size: 18px; padding: 15px 40px; margin-top: 15px;">
                                        ✅ CONFIRMAR SALIDA
                                    </button>
                                </div>
                            </div>
                             `;
                    });
                }

                if (pendingReturnAuths.length > 0) {
                    html += '<h4 style="color: #2c3e50; margin: 35px 0 15px 0;">🔁 Regresos por registrar</h4>';
                    pendingReturnAuths.forEach(auth => {
                        const staff = staffMap[auth.colaborador_id];
                        const reason = reasonMap[auth.motivo_id];
                        const user = userMap[auth.usuario_autorizador_id];
                        const exitTime = auth.salida_efectiva ? formatDateTime(auth.salida_efectiva) : formatTime(auth.hora_salida);
                        const expectedReturn = auth.hora_regreso_estimada ? formatTime(auth.hora_regreso_estimada) : 'Sin hora definida';

                        html += `
                            <div class="verification-card staff-card return-pending" data-auth-id="${auth.id}" data-card-type="return">
                                <h3>🔁 PENDIENTE REGISTRAR REGRESO</h3>
                                <div class="verification-card-content">
                                    <div class="verification-card-info">
                                        <p><strong>👥 Colaborador:</strong> <span class="info-value">${staff ? sanitizeHtml(staff.nombre) : 'No encontrado'}</span></p>
                                        <p><strong>💼 Cargo:</strong> <span class="info-value">${staff?.cargo ? sanitizeHtml(staff.cargo) : 'No registrado'}</span></p>
                                    </div>
                                    <div class="verification-card-info">
                                        <p><strong>🧾 Cédula:</strong> <span class="info-value">${staff?.cedula ? sanitizeHtml(staff.cedula) : 'N/A'}</span></p>
                                        <p><strong>✅ Salida confirmada:</strong> <span class="info-value">${sanitizeHtml(exitTime)}</span></p>
                                        <p><strong>🔁 Hora de regreso:</strong> <span class="info-value">${sanitizeHtml(expectedReturn)}</span></p>
                                    </div>
                                </div>
                                <div class="verification-card-footer">
                                    <p><strong>✅ Autorizado por:</strong> ${user?.nombre ? sanitizeHtml(user.nombre) : 'No encontrado'}</p>
                                    ${reason?.nombre ? `<p><strong>📝 Motivo:</strong> ${sanitizeHtml(reason.nombre)}</p>` : ''}
                                    ${auth.observaciones ? `<div class="verification-card-obs"><strong>📝 Observaciones:</strong><br>${sanitizeHtml(auth.observaciones)}</div>` : ''}
                                    <p style="margin-top: 10px; font-weight: 600;">📝 Registra la hora exacta de regreso al confirmar.</p>
                                    <button class="btn btn-success" onclick="confirmStaffReturn(${auth.id})" style="font-size: 18px; padding: 15px 40px; margin-top: 15px;">
                                        ✅ REGISTRAR REGRESO
                                    </button>
                                </div>
                            </div>
                                `;
                    });
                }
                    
                pendingList.innerHTML = html;

            } catch (error) {
                console.error('❌ Error al cargar salidas del personal:', error);
                await logSecurityEvent('error', 'Error al cargar salidas de personal', {
                    error: error.message.substring(0, 200)
                }, false);
                pendingList.innerHTML = `
                    <div class="verification-card not-authorized">
                        <h3>❌ Error al cargar</h3>
                        <p>No se pudieron cargar las salidas del personal</p>
                        <p><strong>Error:</strong> ${error.message}</p>
                        <button class="btn btn-secondary" onclick="loadPendingStaffExits()" style="margin-top: 10px;">
                            🔄 Intentar de nuevo
                        </button>
                    </div>
                `;
            }
        }

        async function confirmExit(authId) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const colombiaDateTime = getColombiaDateTime();

                const { data, error } = await supabaseClient
                    .from('autorizaciones_salida')
                    .update({
                        salida_efectiva: colombiaDateTime,
                        vigilante_id: currentUser.id
                    })
                    .eq('id', authId);

                if (error) throw error;

                await logSecurityEvent('update', 'Salida confirmada', { 
                    authId, 
                    vigilanteId: currentUser.id 
                }, true);

                const colombiaTime = getColombiaTime();
                showSuccess(`Salida confirmada exitosamente a las ${colombiaTime}`);
                
                const confirmButton = document.querySelector(`button[onclick="confirmExit(${authId})"]`);
                if (confirmButton) {
                    const card = confirmButton.closest('.verification-card');
                    if (card) {
                        card.classList.remove('authorized');
                        card.classList.add('verified');
                        
                        const titleElement = card.querySelector('h3');
                        if (titleElement) {
                            titleElement.textContent = '✅ SALIDA CONFIRMADA';
                        }
                        
                        const footerElement = confirmButton.closest('.verification-card-footer');
                        if (footerElement) {
                            const observationsHtml = footerElement.querySelector('.verification-card-obs')?.outerHTML || '';
                            
                            footerElement.innerHTML = `
                                <p><strong>✅ Autorizado por:</strong> Usuario</p>
                                ${observationsHtml}
                                <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 10px; margin-top: 15px;">
                                    <p style="color: white; font-weight: bold; margin: 0;">
                                        ✅ SALIDA CONFIRMADA<br>
                                        <small>Hora: ${colombiaTime} - Vigilante: ${sanitizeHtml(currentUser.nombre)}</small>
                                    </p>
                                </div>
                            `;
                        }
                        
                        card.style.transform = 'scale(1.02)';
                        setTimeout(() => {
                            card.style.transform = 'scale(1)';
                        }, 300);
                    }
                }
                
                const searchInput = document.getElementById('studentSearch');
                if (searchInput) {
                    searchInput.value = '';
                }
                const searchResult = document.getElementById('searchResult');
                if (searchResult) {
                    searchResult.innerHTML = '';
                }
                
                if (currentUser.rol.nombre === 'vigilante') {
                    setTimeout(async () => {
                        await loadPendingExits();
                    }, 2000);
                }
                
            } catch (error) {
                await logSecurityEvent('error', 'Error al confirmar salida', { 
                    authId,
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al confirmar la salida: ' + error.message);
            }
        }

         function removePendingStaffCard(authId, cardType) {
            const card = document.querySelector(`.staff-card[data-auth-id="${authId}"][data-card-type="${cardType}"]`);
            if (card) {
                card.remove();
            }
        }

        async function confirmStaffExit(authId) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const colombiaDateTime = getColombiaDateTime();

                const { data, error } = await supabaseClient
                    .from('autorizaciones_personal')
                    .update({
                        salida_efectiva: colombiaDateTime,
                        vigilante_id: currentUser.id
                    })
                    .eq('id', authId)
                    .select('requiere_regreso, hora_regreso_estimada')
                    .maybeSingle();

                if (error) throw error;

              let authorizationData = data;

                if (!authorizationData) {
                    const { data: fetchedData, error: fetchError } = await supabaseClient
                        .from('autorizaciones_personal')
                        .select('requiere_regreso, hora_regreso_estimada')
                        .eq('id', authId)
                        .maybeSingle();

                    if (fetchError) throw fetchError;

                    if (!fetchedData) {
                        showError('No se encontró la autorización de salida del colaborador. Verifica que siga disponible.');
                        return;
                    }

                    authorizationData = fetchedData;
                }
                    
                await logSecurityEvent('update', 'Salida de personal confirmada', {
                    authId,
                    vigilanteId: currentUser.id,
                    requiresReturn: authorizationData?.requiere_regreso || false
                }, true);

                const colombiaTime = getColombiaTime();
                let successMessage = `Salida del personal confirmada exitosamente a las ${colombiaTime}.`;
                if (authorizationData?.requiere_regreso) {
                    const expectedReturn = authorizationData.hora_regreso_estimada ? formatTime(authorizationData.hora_regreso_estimada) : 'sin hora estimada';
                    successMessage += ` Regreso pendiente${authorizationData.hora_regreso_estimada ? ` a las ${expectedReturn}` : ''}.`;
                }
                showSuccess(successMessage);

                removePendingStaffCard(authId, 'exit');
                    
                await loadPendingStaffExits();

                } catch (error) {
                await logSecurityEvent('error', 'Error al confirmar salida de personal', {
                    authId,
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al confirmar la salida: ' + error.message);
            }
        }

        async function confirmStaffReturn(authId) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const colombiaDateTime = getColombiaDateTime();

                const { data, error } = await supabaseClient
                    .from('autorizaciones_personal')
                    .update({
                        regreso_efectivo: colombiaDateTime,
                        vigilante_regreso_id: currentUser.id
                    })
                    .eq('id', authId)
                    .select('hora_regreso_estimada, salida_efectiva')
                    .maybeSingle();

                if (error) throw error;

                let authorizationData = data;

                if (!authorizationData) {
                    const { data: fetchedData, error: fetchError } = await supabaseClient
                        .from('autorizaciones_personal')
                        .select('hora_regreso_estimada, salida_efectiva')
                        .eq('id', authId)
                        .maybeSingle();

                    if (fetchError) throw fetchError;

                    if (!fetchedData) {
                        showError('No se encontró la autorización de regreso del colaborador. Verifica que siga disponible.');
                        return;
                    }

                    authorizationData = fetchedData;
                }

                await logSecurityEvent('update', 'Regreso de personal confirmado', {
                    authId,
                    vigilanteId: currentUser.id
                }, true);

                const colombiaTime = getColombiaTime();
                let successMessage = `Regreso del personal registrado a las ${colombiaTime}.`;
                if (authorizationData?.hora_regreso_estimada) {
                    successMessage += ` Hora estimada de regreso: ${formatTime(authorizationData.hora_regreso_estimada)}.`;
                }
                showSuccess(successMessage);

                removePendingStaffCard(authId, 'return');

                await loadPendingStaffExits();
                    
            } catch (error) {
                await logSecurityEvent('error', 'Error al confirmar regreso de personal', {
                    authId,
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al registrar el regreso: ' + error.message);
            }
        }

        function toggleSearch() {
            const searchSection = document.getElementById('searchSection');
            const pendingSection = document.getElementById('pendingExitsSection');
            const myConfirmedSection = document.getElementById('myConfirmedSection');
            
            if (searchSection.style.display === 'none') {
                searchSection.style.display = 'block';
                pendingSection.style.display = 'none';
                myConfirmedSection.style.display = 'none';
            } else {
                searchSection.style.display = 'none';
                pendingSection.style.display = 'block';
                myConfirmedSection.style.display = 'none';
                // Limpiar búsqueda
                document.getElementById('studentSearch').value = '';
                document.getElementById('searchResult').innerHTML = '';
                // Recargar pendientes
                loadPendingExits();
            }
        }

        // ========================================
        // FUNCIONES DE ADMINISTRACIÓN CON SEGURIDAD
        // ========================================

        function showAdminSection(section) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            if (currentUser.rol.nombre !== 'administrador') {
                showError('No tienes permisos para acceder a esta sección');
                return;
            }

            document.querySelectorAll('.admin-subsection').forEach(sub => {
                sub.style.display = 'none';
            });
            document.getElementById(`admin${section.charAt(0).toUpperCase() + section.slice(1)}`).style.display = 'block';
            
            if (section === 'security') {
                loadSecurityStats();
                loadSecurityLogs();
                } else if (section === 'guards') {
                loadGuards();
            } else if (section === 'visitorProfiles') {
                loadVisitorProfiles();
            } else if (section === 'visitorAreas') {
                loadVisitorAreas();
            } else if (section === 'visitorStatuses') {
                loadVisitorStatuses();
            }
            
            renewSession();
        }

        async function loadSecurityStats() {
            try {
                if (!validateSession()) return;

                const todayColombia = getColombiaDate();
                
                const { data: todayLogs, error: logsError } = await supabaseClient
                    .from('audit_logs')
                    .select('*')
                    .gte('timestamp', todayColombia + 'T00:00:00')
                    .lte('timestamp', todayColombia + 'T23:59:59');

                if (!logsError && todayLogs) {
                    const loginCount = todayLogs.filter(log => log.tipo === 'login' && log.exitoso).length;
                    const changeCount = todayLogs.filter(log => ['create', 'update', 'delete'].includes(log.tipo)).length;
                    const failedCount = todayLogs.filter(log => !log.exitoso).length;
                    
                    document.getElementById('todayLogins').textContent = loginCount;
                    document.getElementById('todayChanges').textContent = changeCount;
                    document.getElementById('failedAttempts').textContent = failedCount;
                }

                const { data: activeUsers, error: usersError } = await supabaseClient
                    .from('usuarios')
                    .select('*')
                    .eq('activo', true);

                if (!usersError && activeUsers) {
                    document.getElementById('activeUsers').textContent = activeUsers.length;
                }

                const logUserSelect = document.getElementById('logUser');
                if (activeUsers && logUserSelect) {
                    logUserSelect.innerHTML = '<option value="">Todos</option>';
                    activeUsers.forEach(user => {
                        const option = document.createElement('option');
                        option.value = user.id;
                        option.textContent = sanitizeHtml(user.nombre);
                        logUserSelect.appendChild(option);
                    });
                }
                
            } catch (error) {
                console.error('Error al cargar estadísticas de seguridad:', error);
                await logSecurityEvent('error', 'Error al cargar estadísticas de seguridad', { 
                    error: error.message.substring(0, 200) 
                }, false);
            }
        }

        async function loadSecurityLogs() {
            try {
                if (!validateSession()) return;

                const dateFrom = document.getElementById('logDateFrom').value;
                const dateTo = document.getElementById('logDateTo').value;
                const logType = document.getElementById('logType').value;
                const logUser = document.getElementById('logUser').value;

                let query = supabaseClient
                    .from('audit_logs')
                    .select(`
                        *,
                        usuario:usuarios(nombre, email)
                    `)
                    .order('timestamp', { ascending: false })
                    .limit(100);

                if (dateFrom) {
                    query = query.gte('timestamp', dateFrom + 'T00:00:00');
                }
                if (dateTo) {
                    query = query.lte('timestamp', dateTo + 'T23:59:59');
                }
                if (logType) {
                    query = query.eq('tipo', logType);
                }
                if (logUser) {
                    query = query.eq('usuario_id', logUser);
                }

                const { data: logs, error } = await query;

                if (error) {
                    console.error('Error al cargar logs:', error);
                    showError('Error al cargar los logs de seguridad');
                    return;
                }

                const tbody = document.querySelector('#securityLogsTable tbody');
                tbody.innerHTML = '';

                if (!logs || logs.length === 0) {
                    tbody.innerHTML = `
                        <tr>
                            <td colspan="6" style="text-align: center; color: #666; padding: 20px;">
                                No se encontraron logs para los filtros seleccionados
                            </td>
                        </tr>
                    `;
                    return;
                }

                logs.forEach(log => {
                    const row = tbody.insertRow();
                    const typeClass = getLogTypeClass(log.tipo);
                    let details = {};
                    
                    try {
                        details = log.detalles ? JSON.parse(log.detalles) : {};
                    } catch (e) {
                        details = { error: 'Error al parsear detalles' };
                    }
                    
                    row.innerHTML = `
                        <td>${formatDateTime(log.timestamp)}</td>
                        <td>${log.usuario ? sanitizeHtml(log.usuario.nombre) : 'Sistema'}</td>
                        <td><span class="log-type ${typeClass}">${sanitizeHtml(log.tipo)}</span></td>
                        <td>${sanitizeHtml(log.accion)}</td>
                        <td title="${sanitizeHtml(JSON.stringify(details))}">${sanitizeHtml(JSON.stringify(details).substring(0, 50))}...</td>
                        <td>${sanitizeHtml(log.ip_address || 'N/A')}</td>
                    `;
                });

                showSuccess(`Se cargaron ${logs.length} registros de logs`);
                
                // Configurar scroll después de cargar logs
                setTimeout(setupTableScroll, 50);
                
            } catch (error) {
                console.error('Error general al cargar logs:', error);
                await logSecurityEvent('error', 'Error al cargar logs de seguridad', { 
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al cargar los logs de seguridad');
            }
        }

        function getLogTypeClass(type) {
            const classes = {
                'login': 'login',
                'logout': 'logout',
                'create': 'create',
                'update': 'update',
                'delete': 'delete',
                'error': 'error'
            };
            return classes[type] || '';
        }

        async function exportLogs() {
            try {
                if (!validateSession()) return;

                const dateFrom = document.getElementById('logDateFrom').value;
                const dateTo = document.getElementById('logDateTo').value;
                const logType = document.getElementById('logType').value;
                const logUser = document.getElementById('logUser').value;

                let query = supabaseClient
                    .from('audit_logs')
                    .select(`
                        *,
                        usuario:usuarios(nombre, email)
                    `)
                    .order('timestamp', { ascending: false });

                if (dateFrom) query = query.gte('timestamp', dateFrom + 'T00:00:00');
                if (dateTo) query = query.lte('timestamp', dateTo + 'T23:59:59');
                if (logType) query = query.eq('tipo', logType);
                if (logUser) query = query.eq('usuario_id', logUser);

                const { data: logs, error } = await query;
                if (error) throw error;

                if (!logs || logs.length === 0) {
                    showError('No se encontraron logs para exportar', 'logExportMessage');
                    return;
                }

                const csvContent = generateCSVFromLogs(logs);
                const today = getColombiaDate();
                downloadCSV(csvContent, `logs_${today}.csv`);

                await logSecurityEvent('export', 'Exportación de logs', {
                    fecha: today,
                    registros: logs.length
                }, true);

                showSuccess(`Logs exportados exitosamente: ${logs.length} registros`, 'logExportMessage');

            } catch (error) {
                console.error('Error exportando logs:', error);
                await logSecurityEvent('error', 'Error al exportar logs', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al exportar logs: ' + error.message, 'logExportMessage');
            }
        }

        // ========================================
        // FUNCIONES DE MODALES CON SEGURIDAD
        // ========================================

        function openModal(modalId) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            document.getElementById(modalId).style.display = 'block';
            currentEditingId = null;
            
            if (modalId === 'studentModal') {
                document.getElementById('studentForm').reset();
            } else if (modalId === 'userModal') {
                document.getElementById('userForm').reset();
                document.getElementById('passwordNote').textContent = '(obligatorio para nuevos usuarios)';
                document.getElementById('userPassword').required = true;
                document.getElementById('userPasswordStrength').style.display = 'none';
            } else if (modalId === 'reasonModal') {
                document.getElementById('reasonForm').reset();
            } else if (modalId === 'gradeModal') {
                document.getElementById('gradeForm').reset();
            } else if (modalId === 'guardModal') {
                document.getElementById('guardForm').reset();
                document.getElementById('guardPasswordNote').textContent = '(obligatorio para nuevos vigilantes)';
                document.getElementById('guardPassword').required = true;
                const strength = document.getElementById('guardPasswordStrength');
                if (strength) strength.style.display = 'none';
            } else if (modalId === 'visitorProfileModal') {
                document.getElementById('visitorProfileForm').reset();
            } else if (modalId === 'visitorAreaModal') {
                document.getElementById('visitorAreaForm').reset();
            } else if (modalId === 'visitorStatusModal') {
                document.getElementById('visitorStatusForm').reset();
            }
            
            renewSession();
        }

        function closeModal(modalId) {
            document.getElementById(modalId).style.display = 'none';
            currentEditingId = null;
        }

        // ========================================
        // FUNCIONES CRUD CON SEGURIDAD MEJORADA
        // ========================================

         async function uploadImageToStorage(file) {
            const fileName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const { data, error } = await supabaseClient.storage
                .from(STORAGE_BUCKET)
                .upload('fotos/' + fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });
            if (error) {
                console.error('Error al subir imagen:', error.message);
                showError('Error subiendo imagen');
                return null;
            }

            const { data: urlData } = supabaseClient
                .storage
                .from(STORAGE_BUCKET)
                .getPublicUrl('fotos/' + fileName);
            return urlData.publicUrl;
        }

        async function saveStudent(e) {
            e.preventDefault();
            
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const name = document.getElementById('studentName').value.trim();
                const lastName = document.getElementById('studentLastName').value.trim();
                const documentValue = document.getElementById('studentDocument').value.trim();
                const gradeId = document.getElementById('studentGrade').value;
                const file = document.getElementById('uploadStudentPhoto').files[0];
                let photoUrl = null;
                if (file) {
                    photoUrl = await uploadImageToStorage(file);
                    if (!photoUrl) return;
                }

                // Validaciones de seguridad
                if (!name || !lastName || !gradeId) {
                    showError('Por favor, completa todos los campos obligatorios');
                    return;
                }

                if (!validateName(name) || !validateName(lastName)) {
                    showError('Los nombres solo deben contener letras, espacios y acentos');
                    return;
                }

                if (documentValue && !validateDocument(documentValue)) {
                    showError('El documento debe contener solo números (6-20 dígitos)');
                    return;
                }

                let result;
                if (currentEditingId) {
                    const updateData = {
                        nombre: name,
                        apellidos: lastName,
                        documento: documentValue || null,
                        grado_id: gradeId
                    };
                    if (photoUrl) updateData.foto_url = photoUrl;
                    result = await supabaseClient
                        .from('estudiantes')
                        .update(updateData)
                        .eq('id', currentEditingId);
                    await logSecurityEvent('update', 'Estudiante actualizado', { 
                        studentId: currentEditingId,
                        name: name.substring(0, 20) + '...',
                        lastName: lastName.substring(0, 20) + '...'
                    }, true);
                } else {
                    const insertData = {
                        nombre: name,
                        apellidos: lastName,
                        documento: documentValue || null,
                        grado_id: gradeId,
                        activo: true
                    };
                    if (photoUrl) insertData.foto_url = photoUrl;
                    result = await supabaseClient
                        .from('estudiantes')
                        .insert([insertData]);
                    await logSecurityEvent('create', 'Estudiante creado', { 
                        name: name.substring(0, 20) + '...',
                        lastName: lastName.substring(0, 20) + '...',
                        gradeId 
                    }, true);
                }

                if (result.error) {
                    console.error('Error al guardar estudiante:', result.error);
                    throw result.error;
                }

                showSuccess('Estudiante guardado exitosamente');
                closeModal('studentModal');
                await loadStudents();
                
            } catch (error) {
                console.error('Error completo al guardar estudiante:', error);
                await logSecurityEvent('error', 'Error al guardar estudiante', { 
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al guardar el estudiante: ' + error.message);
            }
        }

        async function saveUser(e) {
            e.preventDefault();
            
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const name = document.getElementById('userName').value.trim();
                const email = document.getElementById('userEmail').value.trim().toLowerCase();
                const password = document.getElementById('userPassword').value;
                const roleId = document.getElementById('userRole').value;

                const cryptoReady = ensureCryptoJSLoaded();
                if (!cryptoReady) {
                    showError('No se pudo cargar la librería de cifrado');
                    return;
                }

                // Validaciones de seguridad
                if (!name || !email || !roleId) {
                    showError('Por favor, completa todos los campos obligatorios');
                    return;
                }

                if (!validateEmail(email)) {
                    showError('Formato de email inválido');
                    return;
                }

                if (!validateName(name)) {
                    showError('El nombre solo debe contener letras, espacios y acentos');
                    return;
                }

                if (!currentEditingId && !password) {
                    showError('La contraseña es obligatoria para nuevos usuarios');
                    return;
                }

                if (password && !validatePassword(password)) {
                    showError('La contraseña debe tener entre 8 y 50 caracteres');
                    return;
                }

                let result;
                if (currentEditingId) {
                    const updateData = {
                        nombre: name,
                        email: email,
                        rol_id: roleId
                    };
                    
                    if (password && password.trim() !== '') {
                        updateData.password_hash = encryptPassword(password);
                    }

                    result = await supabaseClient
                        .from('usuarios')
                        .update(updateData)
                        .eq('id', currentEditingId);
                        
                    await logSecurityEvent('update', 'Usuario actualizado', { 
                        userId: currentEditingId, 
                        email: email.substring(0, 20) + '...',
                        passwordChanged: !!password
                    }, true);
                } else {
                    result = await supabaseClient
                        .from('usuarios')
                        .insert([{
                            nombre: name,
                            email: email,
                            password_hash: encryptPassword(password),
                            rol_id: roleId,
                            activo: true
                        }]);
                        
                    await logSecurityEvent('create', 'Usuario creado', { 
                        email: email.substring(0, 20) + '...',
                        roleId 
                    }, true);
                }

                if (result.error) {
                    console.error('Error al guardar usuario:', result.error);
                    if (result.error.code === '23505') {
                        showError('Ya existe un usuario con ese email');
                    } else {
                        throw result.error;
                    }
                    return;
                }

                showSuccess('Usuario guardado exitosamente');
                closeModal('userModal');
                await loadUsers();
                
            } catch (error) {
                console.error('Error completo al guardar usuario:', error);
                await logSecurityEvent('error', 'Error al guardar usuario', { 
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al guardar el usuario: ' + error.message);
            }
        }

        async function saveGuard(e) {
            e.preventDefault();

            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const name = document.getElementById('guardName').value.trim();
                const email = document.getElementById('guardEmail').value.trim().toLowerCase();
                const password = document.getElementById('guardPassword').value;
                const guardRoleId = getRoleIdByName('vigilante');

                if (!guardRoleId) {
                    showError('No se encontró el rol de vigilante. Verifica la configuración de roles.');
                    return;
                }

                const cryptoReady = ensureCryptoJSLoaded();
                if (!cryptoReady) {
                    showError('No se pudo cargar la librería de cifrado');
                    return;
                }

                if (!name || !email) {
                    showError('Por favor, completa todos los campos obligatorios');
                    return;
                }

                if (!validateEmail(email)) {
                    showError('Formato de email inválido');
                    return;
                }

                if (!validateName(name)) {
                    showError('El nombre solo debe contener letras, espacios y acentos');
                    return;
                }

                if (!currentEditingId && !password) {
                    showError('La contraseña es obligatoria para nuevos vigilantes');
                    return;
                }

                if (password && !validatePassword(password)) {
                    showError('La contraseña debe tener entre 8 y 50 caracteres');
                    return;
                }

                let result;
                if (currentEditingId) {
                    const updateData = {
                        nombre: name,
                        email: email,
                        rol_id: guardRoleId
                    };

                    if (password && password.trim() !== '') {
                        updateData.password_hash = encryptPassword(password);
                    }

                    result = await supabaseClient
                        .from('usuarios')
                        .update(updateData)
                        .eq('id', currentEditingId);

                    await logSecurityEvent('update', 'Vigilante actualizado', {
                        userId: currentEditingId,
                        email: email.substring(0, 20) + '...',
                        passwordChanged: !!password
                    }, true);
                } else {
                    result = await supabaseClient
                        .from('usuarios')
                        .insert([{
                            nombre: name,
                            email: email,
                            password_hash: encryptPassword(password),
                            rol_id: guardRoleId,
                            activo: true
                        }]);

                    await logSecurityEvent('create', 'Vigilante creado', {
                        email: email.substring(0, 20) + '...',
                        roleId: guardRoleId
                    }, true);
                }

                if (result.error) {
                    console.error('Error al guardar vigilante:', result.error);
                    if (result.error.code === '23505') {
                        showError('Ya existe un usuario con ese email');
                    } else {
                        throw result.error;
                    }
                    return;
                }

                showSuccess('Vigilante guardado exitosamente');
                closeModal('guardModal');
                await loadGuards();

            } catch (error) {
                console.error('Error completo al guardar vigilante:', error);
                await logSecurityEvent('error', 'Error al guardar vigilante', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al guardar el vigilante: ' + error.message);
            }
        }

        async function saveReason(e) {
            e.preventDefault();
            
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const name = document.getElementById('reasonName').value.trim();
                const description = document.getElementById('reasonDescription').value.trim();

                if (!name) {
                    showError('El nombre del motivo es obligatorio');
                    return;
                }

                if (name.length > 50) {
                    showError('El nombre del motivo no puede exceder 50 caracteres');
                    return;
                }

                if (!validateText(name) || (description && !validateText(description))) {
                    showError('El texto contiene caracteres no permitidos');
                    return;
                }

                let result;
                if (currentEditingId) {
                    result = await supabaseClient
                        .from('motivos')
                        .update({
                            nombre: name,
                            descripcion: description || null
                        })
                        .eq('id', currentEditingId);
                        
                    await logSecurityEvent('update', 'Motivo actualizado', { 
                        reasonId: currentEditingId,
                        name: name.substring(0, 30) + '...'
                    }, true);
                } else {
                    result = await supabaseClient
                        .from('motivos')
                        .insert([{
                            nombre: name,
                            descripcion: description || null,
                            activo: true
                        }]);
                        
                    await logSecurityEvent('create', 'Motivo creado', { 
                        name: name.substring(0, 30) + '...'
                    }, true);
                }

                if (result.error) {
                    console.error('Error al guardar motivo:', result.error);
                    throw result.error;
                }

                showSuccess('Motivo guardado exitosamente');
                closeModal('reasonModal');
                await loadReasons();
                
            } catch (error) {
                console.error('Error completo al guardar motivo:', error);
                await logSecurityEvent('error', 'Error al guardar motivo', { 
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al guardar el motivo: ' + error.message);
            }
        }

        async function saveGrade(e) {
            e.preventDefault();
            
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const name = document.getElementById('gradeName').value.trim();
                const level = document.getElementById('gradeLevel').value;

                if (!name || !level) {
                    showError('Por favor, completa todos los campos obligatorios');
                    return;
                }

                if (name.length > 20) {
                    showError('El nombre del grado no puede exceder 20 caracteres');
                    return;
                }

                if (!validateText(name)) {
                    showError('El nombre contiene caracteres no permitidos');
                    return;
                }

                let result;
                if (currentEditingId) {
                    result = await supabaseClient
                        .from('grados')
                        .update({
                            nombre: name,
                            nivel: level
                        })
                        .eq('id', currentEditingId);
                        
                    await logSecurityEvent('update', 'Grado actualizado', { 
                        gradeId: currentEditingId,
                        name: name,
                        level: level
                    }, true);
                } else {
                    result = await supabaseClient
                        .from('grados')
                        .insert([{
                            nombre: name,
                            nivel: level,
                            activo: true
                        }]);
                        
                    await logSecurityEvent('create', 'Grado creado', { 
                        name: name, 
                        level: level 
                    }, true);
                }

                if (result.error) {
                    console.error('Error al guardar grado:', result.error);
                    throw result.error;
                }

                showSuccess('Grado guardado exitosamente');
                closeModal('gradeModal');
                await loadGrades();
                
            } catch (error) {
                console.error('Error completo al guardar grado:', error);
                await logSecurityEvent('error', 'Error al guardar grado', { 
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al guardar el grado: ' + error.message);
            }
        }

        async function saveVisitorProfile(e) {
            e.preventDefault();

        try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const name = document.getElementById('visitorProfileName').value.trim();

                if (!name) {
                    showError('El nombre del perfil es obligatorio');
                    return;
                }

                if (name.length > 50) {
                    showError('El nombre del perfil no puede exceder 50 caracteres');
                    return;
                }

                if (!validateText(name)) {
                    showError('El nombre contiene caracteres no permitidos');
                    return;
                }

                let result;
                if (currentEditingId) {
                    result = await supabaseClient
                        .from('perfiles_visitante')
                        .update({
                            nombre: name
                        })
                        .eq('id', currentEditingId);

                    await logSecurityEvent('update', 'Perfil de visitante actualizado', {
                        profileId: currentEditingId,
                        name: name.substring(0, 30) + '...'
                    }, true);
                } else {
                    result = await supabaseClient
                        .from('perfiles_visitante')
                        .insert([{
                            nombre: name,
                            activo: true
                        }]);

                    await logSecurityEvent('create', 'Perfil de visitante creado', {
                        name: name.substring(0, 30) + '...'
                    }, true);
                }

                if (result.error) {
                    console.error('Error al guardar perfil de visitante:', result.error);
                    throw result.error;
                }

                showSuccess('Perfil de visitante guardado exitosamente');
                closeModal('visitorProfileModal');
                await loadVisitorProfiles();

            } catch (error) {
                console.error('Error completo al guardar perfil de visitante:', error);
                await logSecurityEvent('error', 'Error al guardar perfil de visitante', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al guardar el perfil: ' + error.message);
            }
        }

        async function saveVisitorArea(e) {
            e.preventDefault();

            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const name = document.getElementById('visitorAreaName').value.trim();

                if (!name) {
                    showError('El nombre del área es obligatorio');
                    return;
                }

                if (name.length > 50) {
                    showError('El nombre del área no puede exceder 50 caracteres');
                    return;
                }

                if (!validateText(name)) {
                    showError('El nombre contiene caracteres no permitidos');
                    return;
                }

                let result;
                if (currentEditingId) {
                    result = await supabaseClient
                        .from('areas_visitante')
                        .update({
                            nombre: name
                        })
                        .eq('id', currentEditingId);

                    await logSecurityEvent('update', 'Área de visitante actualizada', {
                        areaId: currentEditingId,
                        name: name.substring(0, 30) + '...'
                    }, true);
                } else {
                    result = await supabaseClient
                        .from('areas_visitante')
                        .insert([{
                            nombre: name,
                            activo: true
                        }]);

                    await logSecurityEvent('create', 'Área de visitante creada', {
                        name: name.substring(0, 30) + '...'
                    }, true);
                }

                if (result.error) {
                    console.error('Error al guardar área de visitante:', result.error);
                    throw result.error;
                }

                showSuccess('Área de visita guardada exitosamente');
                closeModal('visitorAreaModal');
                await loadVisitorAreas();

            } catch (error) {
                console.error('Error completo al guardar área de visitante:', error);
                await logSecurityEvent('error', 'Error al guardar área de visitante', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al guardar el área: ' + error.message);
            }
        }

        async function saveVisitorStatus(e) {
            e.preventDefault();

            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const name = document.getElementById('visitorStatusName').value.trim();

                if (!name) {
                    showError('El nombre del estado es obligatorio');
                    return;
                }

                if (name.length > 50) {
                    showError('El nombre del estado no puede exceder 50 caracteres');
                    return;
                }

                if (!validateText(name)) {
                    showError('El nombre contiene caracteres no permitidos');
                    return;
                }

                let result;
                if (currentEditingId) {
                    result = await supabaseClient
                        .from('estados_visitante')
                        .update({
                            nombre: name
                        })
                        .eq('id', currentEditingId);

                    await logSecurityEvent('update', 'Estado de visitante actualizado', {
                        statusId: currentEditingId,
                        name: name.substring(0, 30) + '...'
                    }, true);
                } else {
                    result = await supabaseClient
                        .from('estados_visitante')
                        .insert([{
                            nombre: name,
                            activo: true
                        }]);

                    await logSecurityEvent('create', 'Estado de visitante creado', {
                        name: name.substring(0, 30) + '...'
                    }, true);
                }

                if (result.error) {
                    console.error('Error al guardar estado de visitante:', result.error);
                    throw result.error;
                }

                showSuccess('Estado de visitante guardado exitosamente');
                closeModal('visitorStatusModal');
                await loadVisitorStatuses();

            } catch (error) {
                console.error('Error completo al guardar estado de visitante:', error);
                await logSecurityEvent('error', 'Error al guardar estado de visitante', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al guardar el estado: ' + error.message);
            }
        }

        // ========================================
        // FUNCIONES DE ACTUALIZACIÓN DE TABLAS (CON SANITIZACIÓN)
        // ========================================

        function updateStudentsTable(students) {
            const tbody = document.querySelector('#studentsTable tbody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            students.forEach(student => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${sanitizeHtml(student.nombre)}</td>
                    <td>${sanitizeHtml(student.apellidos)}</td>
                    <td>${student.documento ? sanitizeHtml(student.documento) : 'N/A'}</td>
                    <td>${student.grado?.nombre ? sanitizeHtml(student.grado.nombre) : 'Sin grado'}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editStudent(${student.id})">Editar</button>
                        <button class="btn btn-danger" onclick="deleteStudent(${student.id})">Eliminar</button>
                    </td>
                `;
            });
            
            // Configurar scroll después de actualizar la tabla
            setTimeout(setupTableScroll, 50);
        }

        function updateUsersTable(users) {
            const tbody = document.querySelector('#usersTable tbody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            users.forEach(user => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${sanitizeHtml(user.nombre)}</td>
                    <td>${sanitizeHtml(user.email)}</td>
                    <td>${user.rol?.descripcion ? sanitizeHtml(user.rol.descripcion) : 'Sin rol'}</td>
                    <td>${user.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editUser(${user.id})">Editar</button>
                        <button class="btn btn-danger" onclick="deleteUser(${user.id})">Eliminar</button>
                    </td>
                `;
            });
            
            setTimeout(setupTableScroll, 50);
        }

        function updateReasonsTable(reasons) {
            const tbody = document.querySelector('#reasonsTable tbody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            reasons.forEach(reason => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${sanitizeHtml(reason.nombre)}</td>
                    <td>${reason.descripcion ? sanitizeHtml(reason.descripcion) : 'N/A'}</td>
                    <td>${reason.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editReason(${reason.id})">Editar</button>
                        <button class="btn btn-danger" onclick="deleteReason(${reason.id})">Eliminar</button>
                    </td>
                `;
            });
            
            setTimeout(setupTableScroll, 50);
        }

        function updateGradesTable(grades) {
            const tbody = document.querySelector('#gradesTable tbody');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            grades.forEach(grade => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${sanitizeHtml(grade.nombre)}</td>
                    <td>${sanitizeHtml(grade.nivel)}</td>
                    <td>${grade.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editGrade(${grade.id})">Editar</button>
                        <button class="btn btn-danger" onclick="deleteGrade(${grade.id})">Eliminar</button>
                    </td>
                `;
            });
            
            setTimeout(setupTableScroll, 50);
        }

        function updateGuardsTable(guards) {
            const tbody = document.querySelector('#guardsTable tbody');
            if (!tbody) return;

            tbody.innerHTML = '';
            guards.forEach(guard => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${sanitizeHtml(guard.nombre)}</td>
                    <td>${sanitizeHtml(guard.email)}</td>
                    <td>${guard.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editGuard(${guard.id})">Editar</button>
                        <button class="btn btn-danger" onclick="deleteGuard(${guard.id})">Eliminar</button>
                    </td>
                `;
            });

            setTimeout(setupTableScroll, 50);
        }

        function updateVisitorProfilesTable(profiles) {
            const tbody = document.querySelector('#visitorProfilesTable tbody');
            if (!tbody) return;

            tbody.innerHTML = '';
            profiles.forEach(profile => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${sanitizeHtml(profile.nombre)}</td>
                    <td>${profile.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editVisitorProfile(${profile.id})">Editar</button>
                        <button class="btn btn-danger" onclick="deleteVisitorProfile(${profile.id})">Eliminar</button>
                    </td>
                `;
            });

            setTimeout(setupTableScroll, 50);
        }

        function updateVisitorAreasTable(areas) {
            const tbody = document.querySelector('#visitorAreasTable tbody');
            if (!tbody) return;

            tbody.innerHTML = '';
            areas.forEach(area => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${sanitizeHtml(area.nombre)}</td>
                    <td>${area.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editVisitorArea(${area.id})">Editar</button>
                        <button class="btn btn-danger" onclick="deleteVisitorArea(${area.id})">Eliminar</button>
                    </td>
                `;
            });

            setTimeout(setupTableScroll, 50);
        }

        function updateVisitorStatusesTable(statuses) {
            const tbody = document.querySelector('#visitorStatusesTable tbody');
            if (!tbody) return;

            tbody.innerHTML = '';
            statuses.forEach(status => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>${sanitizeHtml(status.nombre)}</td>
                    <td>${status.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editVisitorStatus(${status.id})">Editar</button>
                        <button class="btn btn-danger" onclick="deleteVisitorStatus(${status.id})">Eliminar</button>
                    </td>
                `;
            });

            setTimeout(setupTableScroll, 50);
        }

        // ========================================
        // FUNCIONES DE HISTORIAL (CON MEJORAS DE SEGURIDAD)
        // ========================================

        async function loadHistory(all = false) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                console.log('🔍 Cargando historial...');
                    const role = currentUser?.rol?.nombre;

                let studentQuery = supabaseClient
                    .from('autorizaciones_salida')
                    .select('*')
                    .order('fecha_creacion', { ascending: false });

                let staffQuery = supabaseClient
                    .from('autorizaciones_personal')
                    .select('*')
                    .order('fecha_creacion', { ascending: false });
                    
                if (!all) {
                    const date = document.getElementById('historyDate').value;
                    if (date) {
                         console.log('🗓️ Filtrando por fecha específica:', date);
                        studentQuery = studentQuery.eq('fecha_salida', date);
                        staffQuery = staffQuery.eq('fecha_salida', date);
                    } else {
                        const todayColombia = getColombiaDate();
                        const thirtyDaysAgo = new Date(todayColombia);
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        const dateLimit = thirtyDaysAgo.toISOString().split('T')[0];
                        console.log('🗓️ Filtrando últimos 30 días desde:', dateLimit, 'hasta:', todayColombia);
                        studentQuery = studentQuery.gte('fecha_salida', dateLimit);
                        staffQuery = staffQuery.gte('fecha_salida', dateLimit);
                    }
                }

               const [studentResult, staffResult] = await Promise.all([
                    role === 'talento_humano' ? Promise.resolve({ data: [] }) : studentQuery,
                    staffQuery
                ]);

                if (studentResult.error) {
                    console.error('❌ Error en historial de estudiantes:', studentResult.error);
                    throw studentResult.error;
                }
                if (staffResult.error) {
                    console.error('❌ Error en historial de personal:', staffResult.error);
                    throw staffResult.error;
                }

               const studentAuths = role === 'talento_humano' ? [] : (studentResult.data || []);
                const staffAuths = staffResult.data || [];
                const combinedRecords = [
                    ...studentAuths.map(record => ({ ...record, tipo: 'estudiante' })),
                    ...staffAuths.map(record => ({ ...record, tipo: 'personal' }))
                ].sort((a, b) => {
                    const dateA = new Date(a.fecha_creacion || `${a.fecha_salida}T00:00:00`);
                    const dateB = new Date(b.fecha_creacion || `${b.fecha_salida}T00:00:00`);
                    return dateB - dateA;
                });

                if (combinedRecords.length === 0) {
                    const tbody = document.querySelector('#historyTable tbody');
                    tbody.innerHTML = `
                        <tr>
                              <td colspan="8" style="text-align: center; color: #666; padding: 20px;">
                                No se encontraron registros para el período seleccionado<br>
                                <small>Zona horaria: Colombia (UTC-5)</small>
                            </td>
                        </tr>
                    `;
                    showSuccess('Historial cargado: 0 registros');
                    return;
                }

                const studentIds = [...new Set(studentAuths.map(auth => auth.estudiante_id))];
                const staffIds = [...new Set(staffAuths.map(auth => auth.colaborador_id))];
                const reasonIds = [...new Set([
                    ...studentAuths.map(auth => auth.motivo_id),
                    ...staffAuths.map(auth => auth.motivo_id)
                ].filter(Boolean))];
                const userIds = [...new Set([
                    ...studentAuths.map(auth => auth.usuario_autorizador_id),
                    ...staffAuths.map(auth => auth.usuario_autorizador_id)
                ])];

                const [studentsResult, staffMembersResult, reasonsResult, usersResult] = await Promise.all([
                    studentIds.length > 0
                        ? supabaseClient
                            .from('estudiantes')
                            .select('id, nombre, apellidos, grado:grados(nombre)')
                            .in('id', studentIds)
                        : Promise.resolve({ data: [] }),
                    staffIds.length > 0
                        ? supabaseClient
                            .from('personal_colegio')
                            .select('id, nombre, cargo, cedula')
                            .in('id', staffIds)
                        : Promise.resolve({ data: [] }),
                    reasonIds.length > 0
                        ? supabaseClient
                            .from('motivos')
                            .select('id, nombre')
                            .in('id', reasonIds)
                        : Promise.resolve({ data: [] }),
                    userIds.length > 0
                        ? supabaseClient
                            .from('usuarios')
                            .select('id, nombre')
                            .in('id', userIds)
                        : Promise.resolve({ data: [] })
                ]);

                const studentMap = {};
                const staffMap = {};
                const reasonMap = {};
                const userMap = {};

                studentsResult.data?.forEach(student => {
                    studentMap[student.id] = student;
                });

                 staffMembersResult.data?.forEach(member => {
                    staffMap[member.id] = member;
                });
                    
                reasonsResult.data?.forEach(reason => {
                    reasonMap[reason.id] = reason;
                });

                usersResult.data?.forEach(user => {
                    userMap[user.id] = user;
                });

                const tbody = document.querySelector('#historyTable tbody');
                tbody.innerHTML = '';

                combinedRecords.forEach(record => {
                    const isStaff = record.tipo === 'personal';
                    const persona = isStaff ? staffMap[record.colaborador_id] : studentMap[record.estudiante_id];
                    const reason = reasonMap[record.motivo_id];
                    const user = userMap[record.usuario_autorizador_id];

                    const personaNombre = isStaff
                        ? (persona ? sanitizeHtml(persona.nombre) : 'Personal no encontrado')
                        : (persona ? `${sanitizeHtml(persona.nombre)} ${sanitizeHtml(persona.apellidos)}` : 'Estudiante no encontrado');

                    let detalleTexto;
                    if (isStaff) {
                        if (persona) {
                            const cargo = persona.cargo ? sanitizeHtml(persona.cargo) : 'Cargo no registrado';
                            const cedula = persona.cedula ? ` • CC ${sanitizeHtml(persona.cedula)}` : '';
                            detalleTexto = `${cargo}${cedula}`;
                        } else {
                            detalleTexto = 'Información no disponible';
                        }
                    } else {
                        detalleTexto = persona?.grado?.nombre ? sanitizeHtml(persona.grado.nombre) : 'Grado no encontrado';
                    }

                    const estadoHtml = record.salida_efectiva
                        ? `✅ Confirmada<br><small style="color: #666;">Hora: ${formatDateTime(record.salida_efectiva)}</small>`
                        : '⏳ Pendiente';

                    const observacionesHtml = record.observaciones
                        ? `<br><small style="color: #666;">Obs: ${sanitizeHtml(record.observaciones)}</small>`
                        : '';

                    const row = tbody.insertRow();
                    row.innerHTML = `
                         <td>${isStaff ? 'Personal' : 'Estudiante'}</td>
                        <td>${personaNombre}</td>
                        <td>${detalleTexto}</td>
                        <td>${reason?.nombre ? sanitizeHtml(reason.nombre) : 'Motivo no encontrado'}</td>
                        <td>${formatDate(record.fecha_salida)}</td>
                        <td>${formatTime(record.hora_salida)}</td>
                        <td>${user?.nombre ? sanitizeHtml(user.nombre) : 'Usuario no encontrado'}</td>
                         <td><span style="color: ${record.salida_efectiva ? '#2ecc71' : '#f39c12'}">${estadoHtml}</span>${observacionesHtml}</td>
                    `;
                });

                const currentTime = getColombiaTime();
                showSuccess(`Historial cargado: ${combinedRecords.length} registros (${currentTime} - Colombia)`);
                console.log('✅ Historial cargado exitosamente');
                
                setTimeout(() => {
                    setupTableScroll();
                }, 100);
                    
            } catch (error) {
                console.error('❌ Error general en loadHistory:', error);
                await logSecurityEvent('error', 'Error al cargar historial', {
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al cargar el historial: ' + error.message);
            }
        }

        async function debugHistory() {
            const debugDiv = document.getElementById('historyDebug');
            const debugContent = document.getElementById('historyDebugContent');
            
            debugDiv.style.display = 'block';
            debugContent.innerHTML = '🔄 Analizando datos del historial...';
            
            try {
                if (!validateSession()) {
                    debugContent.innerHTML = '❌ Sesión expirada';
                    return;
                }

                console.log('🔧 Iniciando debug del historial...');
                
                const todayColombia = getColombiaDate();
                const currentTime = getColombiaTime();
                
                const [
                    totalAuthResult,
                    totalStaffAuthResult,
                    totalStudentsResult,
                    totalStaffResult,
                    totalUsersResult,
                    totalReasonsResult,
                    totalGradesResult,
                    todayAuthResult,
                    todayStaffResult,
                    lastAuthResult,
                    lastStaffResult
                ] = await Promise.all([
                    supabaseClient.from('autorizaciones_salida').select('*'),
                    supabaseClient.from('autorizaciones_personal').select('*'),
                    supabaseClient.from('estudiantes').select('*'),
                    supabaseClient.from('personal_colegio').select('*'),
                    supabaseClient.from('usuarios').select('*'),
                    supabaseClient.from('motivos').select('*'),
                    supabaseClient.from('grados').select('*'),
                    supabaseClient.from('autorizaciones_salida').select('*').eq('fecha_salida', todayColombia),
                    supabaseClient.from('autorizaciones_personal').select('*').eq('fecha_salida', todayColombia),
                    supabaseClient.from('autorizaciones_salida').select('*').order('fecha_creacion', { ascending: false }).limit(5),
                    supabaseClient.from('autorizaciones_personal').select('*').order('fecha_creacion', { ascending: false }).limit(5)
                ]);
                
                let html = '<ul style="text-align: left;">';
                html += `<li><strong>🕐 Hora actual Colombia:</strong> ${formatDate(todayColombia)} ${currentTime} (UTC-5)</li>`;
                html += `<li><strong>📊 Total autorizaciones estudiantes:</strong> ${totalAuthResult.data?.length || 0} ${totalAuthResult.error ? '❌ Error: ' + totalAuthResult.error.message : '✅'}</li>`;
                html += `<li><strong>👥 Total autorizaciones personal:</strong> ${totalStaffAuthResult.data?.length || 0} ${totalStaffAuthResult.error ? '❌ Error: ' + totalStaffAuthResult.error.message : '✅'}</li>`;
                html += `<li><strong>👨‍🎓 Total estudiantes:</strong> ${totalStudentsResult.data?.length || 0} ${totalStudentsResult.error ? '❌ Error: ' + totalStudentsResult.error.message : '✅'}</li>`;
                html += `<li><strong>👥 Total colaboradores:</strong> ${totalStaffResult.data?.length || 0} ${totalStaffResult.error ? '❌ Error: ' + totalStaffResult.error.message : '✅'}</li>`;
                html += `<li><strong>👥 Total usuarios:</strong> ${totalUsersResult.data?.length || 0} ${totalUsersResult.error ? '❌ Error: ' + totalUsersResult.error.message : '✅'}</li>`;
                html += `<li><strong>📝 Total motivos:</strong> ${totalReasonsResult.data?.length || 0} ${totalReasonsResult.error ? '❌ Error: ' + totalReasonsResult.error.message : '✅'}</li>`;
                html += `<li><strong>🎓 Total grados:</strong> ${totalGradesResult.data?.length || 0} ${totalGradesResult.error ? '❌ Error: ' + totalGradesResult.error.message : '✅'}</li>`;
                html += `<li><strong>📅 Autorizaciones estudiantes hoy (${formatDate(todayColombia)}):</strong> ${todayAuthResult.data?.length || 0} ${todayAuthResult.error ? '❌ Error: ' + todayAuthResult.error.message : '✅'}</li>`;
                html += `<li><strong>📅 Autorizaciones personal hoy (${formatDate(todayColombia)}):</strong> ${todayStaffResult.data?.length || 0} ${todayStaffResult.error ? '❌ Error: ' + todayStaffResult.error.message : '✅'}</li>`;
                html += `<li><strong>🕐 Últimas 5 autorizaciones estudiantes:</strong> ${lastAuthResult.data?.length || 0} ${lastAuthResult.error ? '❌ Error: ' + lastAuthResult.error.message : '✅'}</li>`;
                html += `<li><strong>🕐 Últimas 5 autorizaciones personal:</strong> ${lastStaffResult.data?.length || 0} ${lastStaffResult.error ? '❌ Error: ' + lastStaffResult.error.message : '✅'}</li>`;
                
                if (lastAuthResult.data && lastAuthResult.data.length > 0) {
                    html += '<li><strong>📋 Detalles de últimas autorizaciones:</strong><br>';
                    lastAuthResult.data.forEach((auth, index) => {
                        const fechaCreacion = auth.fecha_creacion ? formatDateTime(auth.fecha_creacion) : 'N/A';
                        html += `&nbsp;&nbsp;${index + 1}. ID: ${auth.id}, Estudiante ID: ${auth.estudiante_id}, Fecha salida: ${auth.fecha_salida}, Autorizada: ${auth.autorizada ? 'Sí' : 'No'}, Creada: ${fechaCreacion}<br>`;
                    });
                    html += '</li>';
                }
                    
                if (lastStaffResult.data && lastStaffResult.data.length > 0) {
                    html += '<li><strong>📋 Detalles de últimas autorizaciones de personal:</strong><br>';
                    lastStaffResult.data.forEach((auth, index) => {
                        const fechaCreacion = auth.fecha_creacion ? formatDateTime(auth.fecha_creacion) : 'N/A';
                        html += `&nbsp;&nbsp;${index + 1}. ID: ${auth.id}, Colaborador ID: ${auth.colaborador_id}, Fecha salida: ${auth.fecha_salida}, Autorizada: ${auth.autorizada ? 'Sí' : 'No'}, Creada: ${fechaCreacion}<br>`;
                    });
                    html += '</li>';
                }
                    
                if (totalAuthResult.data && totalAuthResult.data.length > 0) {
                    const sampleAuth = totalAuthResult.data[0];
                    html += '<li><strong>🔍 Estructura de autorización (muestra):</strong><br>';
                    html += `&nbsp;&nbsp;Columnas disponibles: ${Object.keys(sampleAuth).join(', ')}<br>`;
                    html += '</li>';
                }
                
                if (totalStaffAuthResult.data && totalStaffAuthResult.data.length > 0) {
                    const sampleStaff = totalStaffAuthResult.data[0];
                    html += '<li><strong>🔍 Estructura de autorización personal (muestra):</strong><br>';
                    html += `&nbsp;&nbsp;Columnas disponibles: ${Object.keys(sampleStaff).join(', ')}<br>`;
                    html += '</li>';
                }
                    
                html += '</ul>';
                
                debugContent.innerHTML = html;
                console.log('🔧 Debug completado');
                
            } catch (error) {
                console.error('❌ Error en debug:', error);
                debugContent.innerHTML = `❌ Error en debug: ${error.message}`;
                await logSecurityEvent('error', 'Error en debug de historial', { 
                    error: error.message.substring(0, 200) 
                }, false);
            }
        }

        // ========================================
        // FUNCIONES DE EDICIÓN Y ELIMINACIÓN (CON VALIDACIONES)
        // ========================================

        async function editStudent(id) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const { data: student, error } = await supabaseClient
                    .from('estudiantes')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                currentEditingId = id;
                document.getElementById('studentName').value = student.nombre;
                document.getElementById('studentLastName').value = student.apellidos;
                document.getElementById('studentDocument').value = student.documento || '';
                document.getElementById('studentGrade').value = student.grado_id;
                
                openModal('studentModal');
                
            } catch (error) {
                await logSecurityEvent('error', 'Error al cargar datos de estudiante', { 
                    studentId: id,
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al cargar los datos del estudiante: ' + error.message);
            }
        }

        async function deleteStudent(id) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            if (confirm('¿Estás seguro de que quieres eliminar este estudiante?')) {
                try {
                    const { data, error } = await supabaseClient
                        .from('estudiantes')
                        .update({ activo: false })
                        .eq('id', id);

                    if (error) throw error;

                    await logSecurityEvent('delete', 'Estudiante eliminado', { studentId: id }, true);
                    showSuccess('Estudiante eliminado exitosamente');
                    await loadStudents();
                    
                } catch (error) {
                    await logSecurityEvent('error', 'Error al eliminar estudiante', { 
                        studentId: id,
                        error: error.message.substring(0, 200) 
                    }, false);
                    showError('Error al eliminar el estudiante: ' + error.message);
                }
            }
        }

        async function editUser(id) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const { data: user, error } = await supabaseClient
                    .from('usuarios')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                currentEditingId = id;
                document.getElementById('userName').value = user.nombre;
                document.getElementById('userEmail').value = user.email;
                document.getElementById('userPassword').value = '';
                document.getElementById('userRole').value = user.rol_id;
                
                document.getElementById('passwordNote').textContent = '(dejar vacío para mantener actual)';
                document.getElementById('userPassword').required = false;
                document.getElementById('userPasswordStrength').style.display = 'none';
                
                openModal('userModal');
                
            } catch (error) {
                await logSecurityEvent('error', 'Error al cargar datos de usuario', { 
                    userId: id,
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al cargar los datos del usuario: ' + error.message);
            }
        }

        async function deleteUser(id) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            if (id === currentUser.id) {
                showError('No puedes eliminar tu propio usuario');
                return;
            }
            
            if (confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
                try {
                    const { data, error } = await supabaseClient
                        .from('usuarios')
                        .update({ activo: false })
                        .eq('id', id);

                    if (error) throw error;

                    await logSecurityEvent('delete', 'Usuario eliminado', { userId: id }, true);
                    showSuccess('Usuario eliminado exitosamente');
                    await loadUsers();
                    
                } catch (error) {
                    await logSecurityEvent('error', 'Error al eliminar usuario', { 
                        userId: id,
                        error: error.message.substring(0, 200) 
                    }, false);
                    showError('Error al eliminar el usuario: ' + error.message);
                }
            }
        }

        async function editGuard(id) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const { data: user, error } = await supabaseClient
                    .from('usuarios')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                currentEditingId = id;
                document.getElementById('guardName').value = user.nombre;
                document.getElementById('guardEmail').value = user.email;
                document.getElementById('guardPassword').value = '';

                document.getElementById('guardPasswordNote').textContent = '(dejar vacío para mantener actual)';
                document.getElementById('guardPassword').required = false;
                const strength = document.getElementById('guardPasswordStrength');
                if (strength) strength.style.display = 'none';

                openModal('guardModal');

            } catch (error) {
                await logSecurityEvent('error', 'Error al cargar datos de vigilante', {
                    userId: id,
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al cargar los datos del vigilante: ' + error.message);
            }
        }

        async function deleteGuard(id) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            if (id === currentUser.id) {
                showError('No puedes eliminar tu propio usuario');
                return;
            }

            if (confirm('¿Estás seguro de que quieres eliminar este vigilante?')) {
                try {
                    const { data, error } = await supabaseClient
                        .from('usuarios')
                        .update({ activo: false })
                        .eq('id', id);

                    if (error) throw error;

                    await logSecurityEvent('delete', 'Vigilante eliminado', { userId: id }, true);
                    showSuccess('Vigilante eliminado exitosamente');
                    await loadGuards();

                } catch (error) {
                    await logSecurityEvent('error', 'Error al eliminar vigilante', {
                        userId: id,
                        error: error.message.substring(0, 200)
                    }, false);
                    showError('Error al eliminar el vigilante: ' + error.message);
                }
            }
        }

        async function editVisitorProfile(id) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const { data: profile, error } = await supabaseClient
                    .from('perfiles_visitante')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                currentEditingId = id;
                document.getElementById('visitorProfileName').value = profile.nombre;

                openModal('visitorProfileModal');

            } catch (error) {
                await logSecurityEvent('error', 'Error al cargar datos de perfil visitante', {
                    profileId: id,
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al cargar los datos del perfil: ' + error.message);
            }
        }

        async function deleteVisitorProfile(id) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            if (confirm('¿Estás seguro de que quieres eliminar este perfil de visitante?')) {
                try {
                    const { data, error } = await supabaseClient
                        .from('perfiles_visitante')
                        .update({ activo: false })
                        .eq('id', id);

                    if (error) throw error;

                    await logSecurityEvent('delete', 'Perfil de visitante eliminado', { profileId: id }, true);
                    showSuccess('Perfil de visitante eliminado exitosamente');
                    await loadVisitorProfiles();

                } catch (error) {
                    await logSecurityEvent('error', 'Error al eliminar perfil de visitante', {
                        profileId: id,
                        error: error.message.substring(0, 200)
                    }, false);
                    showError('Error al eliminar el perfil: ' + error.message);
                }
            }
        }

        async function editVisitorArea(id) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const { data: area, error } = await supabaseClient
                    .from('areas_visitante')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                currentEditingId = id;
                document.getElementById('visitorAreaName').value = area.nombre;

                openModal('visitorAreaModal');

            } catch (error) {
                await logSecurityEvent('error', 'Error al cargar datos de área visitante', {
                    areaId: id,
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al cargar los datos del área: ' + error.message);
            }
        }

        async function deleteVisitorArea(id) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            if (confirm('¿Estás seguro de que quieres eliminar esta área de visita?')) {
                try {
                    const { data, error } = await supabaseClient
                        .from('areas_visitante')
                        .update({ activo: false })
                        .eq('id', id);

                    if (error) throw error;

                    await logSecurityEvent('delete', 'Área de visitante eliminada', { areaId: id }, true);
                    showSuccess('Área de visita eliminada exitosamente');
                    await loadVisitorAreas();

                } catch (error) {
                    await logSecurityEvent('error', 'Error al eliminar área de visitante', {
                        areaId: id,
                        error: error.message.substring(0, 200)
                    }, false);
                    showError('Error al eliminar el área: ' + error.message);
                }
            }
        }

        async function editVisitorStatus(id) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const { data: status, error } = await supabaseClient
                    .from('estados_visitante')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                currentEditingId = id;
                document.getElementById('visitorStatusName').value = status.nombre;

                openModal('visitorStatusModal');

            } catch (error) {
                await logSecurityEvent('error', 'Error al cargar datos de estado visitante', {
                    statusId: id,
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al cargar los datos del estado: ' + error.message);
            }
        }

        async function deleteVisitorStatus(id) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            if (confirm('¿Estás seguro de que quieres eliminar este estado de visitante?')) {
                try {
                    const { data, error } = await supabaseClient
                        .from('estados_visitante')
                        .update({ activo: false })
                        .eq('id', id);

                    if (error) throw error;

                    await logSecurityEvent('delete', 'Estado de visitante eliminado', { statusId: id }, true);
                    showSuccess('Estado de visitante eliminado exitosamente');
                    await loadVisitorStatuses();

                } catch (error) {
                    await logSecurityEvent('error', 'Error al eliminar estado de visitante', {
                        statusId: id,
                        error: error.message.substring(0, 200)
                    }, false);
                    showError('Error al eliminar el estado: ' + error.message);
                }
            }
        }

        async function editReason(id) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const { data: reason, error } = await supabaseClient
                    .from('motivos')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                currentEditingId = id;
                document.getElementById('reasonName').value = reason.nombre;
                document.getElementById('reasonDescription').value = reason.descripcion || '';
                
                openModal('reasonModal');
                
            } catch (error) {
                await logSecurityEvent('error', 'Error al cargar datos de motivo', { 
                    reasonId: id,
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al cargar los datos del motivo: ' + error.message);
            }
        }

        async function deleteReason(id) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            if (confirm('¿Estás seguro de que quieres eliminar este motivo?')) {
                try {
                    const { data, error } = await supabaseClient
                        .from('motivos')
                        .update({ activo: false })
                        .eq('id', id);

                    if (error) throw error;

                    await logSecurityEvent('delete', 'Motivo eliminado', { reasonId: id }, true);
                    showSuccess('Motivo eliminado exitosamente');
                    await loadReasons();
                    
                } catch (error) {
                    await logSecurityEvent('error', 'Error al eliminar motivo', { 
                        reasonId: id,
                        error: error.message.substring(0, 200) 
                    }, false);
                    showError('Error al eliminar el motivo: ' + error.message);
                }
            }
        }

        async function editGrade(id) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const { data: grade, error } = await supabaseClient
                    .from('grados')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                currentEditingId = id;
                document.getElementById('gradeName').value = grade.nombre;
                document.getElementById('gradeLevel').value = grade.nivel;
                
                openModal('gradeModal');
                
            } catch (error) {
                await logSecurityEvent('error', 'Error al cargar datos de grado', { 
                    gradeId: id,
                    error: error.message.substring(0, 200) 
                }, false);
                showError('Error al cargar los datos del grado: ' + error.message);
            }
        }

        async function deleteGrade(id) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            if (confirm('¿Estás seguro de que quieres eliminar este grado?')) {
                try {
                    const { data, error } = await supabaseClient
                        .from('grados')
                        .update({ activo: false })
                        .eq('id', id);

                    if (error) throw error;

                    await logSecurityEvent('delete', 'Grado eliminado', { gradeId: id }, true);
                    showSuccess('Grado eliminado exitosamente');
                    await loadGrades();
                    
                } catch (error) {
                    await logSecurityEvent('error', 'Error al eliminar grado', { 
                        gradeId: id,
                        error: error.message.substring(0, 200) 
                    }, false);
                    showError('Error al eliminar el grado: ' + error.message);
                }
            }
        }

        // ========================================
        // EVENT LISTENERS Y CONFIGURACIÓN INICIAL
        // ========================================

        // Cerrar modales al hacer clic fuera
        window.onclick = function(event) {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        // Prevenir inyección de scripts en todos los inputs
        document.addEventListener('input', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                const value = e.target.value;
                
                // Detectar y bloquear scripts maliciosos
                const scriptPatterns = [
                    /<script[^>]*>.*?<\/script>/gi,
                    /javascript:/gi,
                    /vbscript:/gi,
                    /on\w+\s*=/gi,
                    /<iframe[^>]*>.*?<\/iframe>/gi,
                    /<object[^>]*>.*?<\/object>/gi,
                    /<embed[^>]*>/gi
                ];
                
                let hasScripts = false;
                scriptPatterns.forEach(pattern => {
                    if (pattern.test(value)) {
                        hasScripts = true;
                    }
                });
                
                if (hasScripts) {
                    e.target.value = value.replace(/[<>]/g, '');
                    showError('Se detectaron caracteres potencialmente peligrosos y fueron removidos');
                    
                    // Log del intento de inyección
                    logSecurityEvent('security', 'Intento de inyección de script detectado', {
                        input: e.target.id || e.target.name || 'campo desconocido',
                        value: value.substring(0, 100) + '...'
                    }, false);
                }
            }
        });

        // Prevenir copiar/pegar código malicioso
        document.addEventListener('paste', function(e) {
            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
            
            const scriptPatterns = [
                /<script[^>]*>.*?<\/script>/gi,
                /javascript:/gi,
                /vbscript:/gi,
                /on\w+\s*=/gi
            ];
            
            let hasScripts = false;
            scriptPatterns.forEach(pattern => {
                if (pattern.test(pastedData)) {
                    hasScripts = true;
                }
            });
            
            if (hasScripts) {
                e.preventDefault();
                showError('El contenido pegado contiene código potencialmente peligroso y fue bloqueado');
                
                logSecurityEvent('security', 'Intento de pegar contenido malicioso', {
                    content: pastedData.substring(0, 100) + '...'
                }, false);
            }
        });

        // Configurar listeners de actividad para sesión
        function setupActivityListeners() {
            const events = ['click', 'keypress', 'mousemove', 'scroll', 'touchstart'];
            events.forEach(event => {
                document.addEventListener(event, () => {
                    if (currentUser && validateSession()) {
                        renewSession();
                    }
                }, { passive: true });
            });
        }

        // Detectar intentos de manipulación del DOM
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // Element node
                            const scripts = node.querySelectorAll ? node.querySelectorAll('script') : [];
                            if (scripts.length > 0) {
                                console.warn('🚨 Intento de inyección de script detectado');
                                scripts.forEach(script => script.remove());
                                
                                logSecurityEvent('security', 'Intento de inyección DOM detectado', {
                                    element: node.tagName || 'unknown'
                                }, false);
                            }
                        }
                    });
                }
            });
        });

        // Inicializar la aplicación con todas las medidas de seguridad
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Sistema iniciado con medidas de seguridad avanzadas');
            console.log('🔒 Medidas activas:');
            console.log('  ✅ Headers de Seguridad CSP');
            console.log('  ✅ Sanitización XSS');
            console.log('  ✅ Rate Limiting');
            console.log('  ✅ Desafío Aritmético Anti-Bot');
            console.log('  ✅ Logs de Auditoría');
            console.log('  ✅ Validación HTML');
            console.log('  ✅ Sesiones Seguras');
            console.log('  ✅ Cifrado de Datos');
            console.log('  ✅ Diseño Responsive');
            console.log('  ✅ Dashboard General');
            console.log('  ✅ Control de Vigilancia');
            
            updateConnectionStatus(false, 'Conectando...');
            updateSecurityIndicator('warning', 'Iniciando Sistema');
            
            if (window.gsap) {
                gsap.from('#loginSection', { duration: 0.6, opacity: 0, y: -20 });
            }

            // Verificar dependencias críticas
            setTimeout(() => {
                console.log('🔍 Verificando dependencias...');
                
                 // Verificar ECharts
                if (typeof echarts === 'undefined') {
                    console.error('❌ ECharts no se cargó correctamente');
                    updateSecurityIndicator('error', 'Error: ECharts no cargado');
                } else {
                    console.log('✅ ECharts cargado correctamente:', echarts.version);
                }
                
                // Verificar Supabase
                if (!window.supabase) {
                    console.error('❌ Supabase no se cargó correctamente');
                    updateSecurityIndicator('error', 'Error: Supabase no cargado');
                } else {
                    console.log('✅ Supabase disponible');
                }
                
                // Verificar CryptoJS
                if (typeof CryptoJS === 'undefined') {
                    console.error('❌ CryptoJS no se cargó correctamente');
                } else {
                    console.log('✅ CryptoJS disponible');
                }
                
            }, 500);
            
            // Configurar observador de DOM
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            // Configurar listeners de actividad
            setupActivityListeners();
            
            // Inicializar responsive design
            detectDeviceAndAdjustUI();
            setupTableScroll();
            enhanceTouchExperience();
            optimizeViewport();
            createMobileQuickActions();
            
            // Listeners para cambios de ventana
            window.addEventListener('resize', () => {
                clearTimeout(window.resizeTimeout);
                window.resizeTimeout = setTimeout(() => {
                    detectDeviceAndAdjustUI();
                    setupTableScroll();
                }, 250);
            });
            
            window.addEventListener('orientationchange', handleOrientationChange);
            
            // Iniciar conexión a Supabase en cuanto las librerías estén listas
            console.log('🔗 Iniciando conexión a Supabase...');
            initSupabase().then((connected) => {
                if (connected && restoreSessionState()) {
                    showDashboard();
                    updateSecurityIndicator('secure', 'Sesión Activa');
                }
            });

            // Generar primera pregunta aritmética
            generateCaptcha();
        });

        // Limpiar recursos al cerrar la página
        window.addEventListener('beforeunload', function() {
            if (currentUser) {
                logSecurityEvent('logout', 'Cierre de página', { 
                    userId: currentUser.id 
                }, true);
            }
            
            // Limpiar datos sensibles
            currentUser = null;
            sessionToken = null;
            sessionStartTime = null;
            lastActivityTime = null;
        });

        // Detectar cambios de visibilidad de la página (seguridad adicional)
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden' && currentUser) {
                // La página se oculta, pausar actividad sensible
                console.log('📱 Página oculta, pausando actividad');
            } else if (document.visibilityState === 'visible' && currentUser) {
                // La página vuelve a ser visible, verificar sesión
                console.log('📱 Página visible, verificando sesión');
                if (!validateSession()) {
                    showError('Sesión expirada por inactividad');
                    logout();
                }
            }
        });

  function handleImageUpload(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('studentPhotoPreview');
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|gif)$/)) {
      alert("Formato no válido. Solo JPG, PNG o GIF.");
      event.target.value = '';
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("La imagen debe ser menor a 2MB.");
      event.target.value = '';
      return;
    }

    preview.src = URL.createObjectURL(file);
  }

  async function cargarVerificaciones() {
    if (!supabaseClient || !validateSession()) return;

    const contenedor = document.getElementById("verificaciones");
    if (!contenedor) {
      console.warn("Contenedor de verificaciones no encontrado");
      return;
    }

    contenedor.innerHTML = "";

    const { data: salidas, error: errorSalidas } = await supabaseClient
      .from("autorizaciones")
      .select("documento, motivo, hora");

    if (errorSalidas) {
      console.error("Error cargando salidas:", errorSalidas.message);
      return;
    }

    for (const salida of salidas) {
      const { data: estudiante, error: errorEst } = await supabaseClient
        .from("estudiantes")
        .select("nombre, grado, foto_url")
        .eq("documento", salida.documento)
        .single();

      const div = document.createElement("div");
      div.className = "verificacion-card";
      div.style = "border:1px solid #ddd; padding:10px; border-radius:10px; margin:10px 0; text-align:center;";

      div.innerHTML = `
        <img src="${estudiante?.foto_url || 'https://via.placeholder.com/120'}"
          alt="Foto estudiante"
          style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:2px solid #bbb;margin-bottom:10px;">
        <h3>${estudiante?.nombre || 'Estudiante'}</h3>
        <p><strong>Grado:</strong> ${estudiante?.grado || '--'}</p>
        <p><strong>Motivo:</strong> ${salida?.motivo || '--'}</p>
        <p><strong>Hora:</strong> ${salida?.hora || '--:--'}</p>
      `;
      contenedor.appendChild(div);
    }
  }


const inputFechaDesde = document.getElementById('fechaDesde');
if (inputFechaDesde) {
  inputFechaDesde.addEventListener('change', function() {
    document.getElementById('historicalWrapper').style.display = 'flex';
  });
}

function checkMostrarHistorico() {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;
  if (desde && hasta) {
    document.getElementById('historicalWrapper').style.display = 'flex';
  }
}
const fechaDesde = document.getElementById('fechaDesde');
if (fechaDesde) fechaDesde.addEventListener('change', checkMostrarHistorico);
const fechaHasta = document.getElementById('fechaHasta');
if (fechaHasta) fechaHasta.addEventListener('change', checkMostrarHistorico);

function actualizarVisibilidadHistorico() {
  const seccionDashboard = document.getElementById('dashboardSectionDiv');
  const wrapperHistorico = document.getElementById('historicalWrapper');
  if (!seccionDashboard.classList.contains('active')) {
    wrapperHistorico.style.display = 'none';
  }
}

// Interceptar todos los clics en los botones de navegación
document.querySelectorAll('.nav-buttons .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setTimeout(actualizarVisibilidadHistorico, 100); // espera pequeña para que cambie la clase
  });
});

document.addEventListener('DOMContentLoaded', function () {
  const user = localStorage.getItem('correo');
  const btnVerificar = document.getElementById('btnVerificarSalida');
  const seccionVerificar = document.getElementById('verificarSectionDiv');

  const permitidos = [
    'convivencia@colgemelli.edu.co',
    'vigilancia@colgemelli.edu.co',
    'sistemas@colgemelli.edu.co'
  ];

  if (permitidos.includes(user)) {
    if (btnVerificar) btnVerificar.style.display = 'inline-block';

    // Solo convivencia en modo consulta
    if (user === 'convivencia@colgemelli.edu.co') {
      const observer = new MutationObserver(() => {
        document.querySelectorAll('.btn-autorizacion').forEach(btn => btn.style.display = 'none');
      });
      if (seccionVerificar) {
        observer.observe(seccionVerificar, { childList: true, subtree: true });
      }
    }
  } else {
    if (btnVerificar) btnVerificar.style.display = 'none';
  }
});

document.addEventListener('DOMContentLoaded', function () {
  const user = localStorage.getItem('correo');
  const btnVerificar = document.getElementById('btnVerificarSalida');
  const btnControl = document.getElementById('btnControlSalidas');
  const seccionVerificar = document.getElementById('verificarSectionDiv');
  const seccionControl = document.getElementById('controlSectionDiv');

  const permitidos = [
    'convivencia@colgemelli.edu.co',
    'vigilancia@colgemelli.edu.co',
    'sistemas@colgemelli.edu.co'
  ];

  if (permitidos.includes(user)) {
    if (btnVerificar) btnVerificar.style.display = 'inline-block';

    if (user === 'convivencia@colgemelli.edu.co') {
      if (btnControl) btnControl.style.display = 'inline-block';
      const observer1 = new MutationObserver(() => {
        document.querySelectorAll('.btn-autorizacion').forEach(btn => btn.style.display = 'none');
      });
      if (seccionVerificar) {
        observer1.observe(seccionVerificar, { childList: true, subtree: true });
      }
      const observer2 = new MutationObserver(() => {
        document.querySelectorAll('.btn-eliminar').forEach(btn => btn.style.display = 'none');
      });
      if (seccionControl) {
        observer2.observe(seccionControl, { childList: true, subtree: true });
      }
    } else {
      if (btnControl) btnControl.style.display = 'inline-block';
    }
  } else {
    if (btnVerificar) btnVerificar.style.display = 'none';
    if (btnControl) btnControl.style.display = 'none';
  }
});

document.addEventListener("DOMContentLoaded", function () {
  const fechaSalida = document.getElementById("fechaSalida");
  if (fechaSalida) {
    fechaSalida.addEventListener("change", function () {
      const selected = new Date(this.value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selected < today) {
        alert("La fecha de salida no puede ser en el pasado");
        this.value = "";
      }
    });
  }
});

function attachEventHandlers() {
    requestNotificationPermission();
    const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const clickHandlers = [
    ['#loginBtn', login],
    ['#testConnectionBtn', testConnection],
    ['#loadPendingBtn', loadPendingExits],
    ['#toggleSearchBtn', toggleSearch],
    ['#showMyConfirmedBtn', showMyConfirmedExits],
    ['#btnAdminStudents', () => showAdminSection('students')],
    ['#btnAdminUsers', () => showAdminSection('users')],
    ['#btnAdminReasons', () => showAdminSection('reasons')],
    ['#btnAdminGrades', () => showAdminSection('grades')],
    ['#btnAdminGuards', () => showAdminSection('guards')],
    ['#btnAdminVisitorProfiles', () => showAdminSection('visitorProfiles')],
    ['#btnAdminVisitorAreas', () => showAdminSection('visitorAreas')],
    ['#btnAdminVisitorStatuses', () => showAdminSection('visitorStatuses')],
    ['#btnAdminSecurity', () => showAdminSection('security')],
    ['#addStudentBtn', () => openModal('studentModal')],
    ['#addUserBtn', () => openModal('userModal')],
    ['#addReasonBtn', () => openModal('reasonModal')],
    ['#addGradeBtn', () => openModal('gradeModal')],
    ['#cancelStudentModal', (e) => { e.preventDefault(); closeModal('studentModal'); }],
    ['#cancelUserModal', (e) => { e.preventDefault(); closeModal('userModal'); }],
    ['#cancelReasonModal', (e) => { e.preventDefault(); closeModal('reasonModal'); }],
    ['#cancelGradeModal', (e) => { e.preventDefault(); closeModal('gradeModal'); }],
    ['#cancelGuardModal', (e) => { e.preventDefault(); closeModal('guardModal'); }],
    ['#cancelVisitorProfileModal', (e) => { e.preventDefault(); closeModal('visitorProfileModal'); }],
    ['#cancelVisitorAreaModal', (e) => { e.preventDefault(); closeModal('visitorAreaModal'); }],
    ['#cancelVisitorStatusModal', (e) => { e.preventDefault(); closeModal('visitorStatusModal'); }],
    ['#filterHistoryBtn', () => loadHistory()],
    ['#viewAllHistoryBtn', () => loadHistory(true)],
    ['#debugHistoryBtn', debugHistory],
    ['#refreshDashboardBtn', refreshDashboard],
    ['#exportDashboardBtn', exportDashboardData],
    ['#showDetailedViewBtn', showDetailedView],
    ['#debugDashboardBtn', debugDashboard],
    ['#loadLogsBtn', loadSecurityLogs],
    ['#exportLogsBtn', exportLogs],
    ['#cancelEditExitBtn', cancelExitEdit]
  ];
  clickHandlers.forEach(([sel, handler]) => {
    const el = document.querySelector(sel);
    if (el) el.addEventListener('click', handler);
  });

  document.querySelectorAll('.modal .close').forEach(span => {
    const modalId = span.closest('.modal').id;
    span.addEventListener('click', () => closeModal(modalId));
  });

  const emailInput = document.getElementById('email');
  if (emailInput) emailInput.addEventListener('input', () => validateEmailInput(emailInput));
  const passwordInput = document.getElementById('password');
  if (passwordInput) passwordInput.addEventListener('input', () => validatePasswordInput(passwordInput));

  document.querySelectorAll('.toggle-password').forEach(icon => {
    const formGroup = icon.closest('.form-group');
    const pwdInput = formGroup ? formGroup.querySelector('input[type="password"], input[type="text"]') : null;
    if (pwdInput) {
      icon.addEventListener('click', () => togglePasswordVisibility(pwdInput.id, icon));
    }
  });

  const gradeSelect = document.getElementById('gradeSelect');
  if (gradeSelect) gradeSelect.addEventListener('change', loadStudentsByGrade);

  const observations = document.getElementById('observations');
  if (observations) observations.addEventListener('input', () => validateTextInput(observations));

  const studentSearch = document.getElementById('studentSearch');
  if (studentSearch) studentSearch.addEventListener('input', () => validateSearchInput(studentSearch));

  const uploadPhoto = document.getElementById('uploadStudentPhoto');
  if (uploadPhoto) uploadPhoto.addEventListener('change', handleImageUpload);

  const studentName = document.getElementById('studentName');
  if (studentName) studentName.addEventListener('input', () => validateNameInput(studentName));
  const studentLastName = document.getElementById('studentLastName');
  if (studentLastName) studentLastName.addEventListener('input', () => validateNameInput(studentLastName));
  const studentDocument = document.getElementById('studentDocument');
  if (studentDocument) studentDocument.addEventListener('input', () => validateDocumentInput(studentDocument));

  const userName = document.getElementById('userName');
  if (userName) userName.addEventListener('input', () => validateNameInput(userName));
  const userEmail = document.getElementById('userEmail');
  if (userEmail) userEmail.addEventListener('input', () => validateEmailInput(userEmail));
  const userPassword = document.getElementById('userPassword');
  if (userPassword) {
    userPassword.addEventListener('input', () => validatePasswordInput(userPassword));
    userPassword.addEventListener('keyup', checkPasswordStrength);
  }

  const guardName = document.getElementById('guardName');
  if (guardName) guardName.addEventListener('input', () => validateNameInput(guardName));
  const guardEmail = document.getElementById('guardEmail');
  if (guardEmail) guardEmail.addEventListener('input', () => validateEmailInput(guardEmail));
  const guardPassword = document.getElementById('guardPassword');
  if (guardPassword) {
    guardPassword.addEventListener('input', () => validatePasswordInput(guardPassword));
    guardPassword.addEventListener('keyup', checkGuardPasswordStrength);
  }
        
  const reasonName = document.getElementById('reasonName');
  if (reasonName) reasonName.addEventListener('input', () => validateTextInput(reasonName));
  const reasonDesc = document.getElementById('reasonDescription');
  if (reasonDesc) reasonDesc.addEventListener('input', () => validateTextInput(reasonDesc));
  const gradeName = document.getElementById('gradeName');
  if (gradeName) gradeName.addEventListener('input', () => validateTextInput(gradeName));

  const visitorProfileName = document.getElementById('visitorProfileName');
  if (visitorProfileName) visitorProfileName.addEventListener('input', () => validateTextInput(visitorProfileName));
  const visitorAreaName = document.getElementById('visitorAreaName');
  if (visitorAreaName) visitorAreaName.addEventListener('input', () => validateTextInput(visitorAreaName));
  const visitorStatusName = document.getElementById('visitorStatusName');
  if (visitorStatusName) visitorStatusName.addEventListener('input', () => validateTextInput(visitorStatusName));
        
  const historyDate = document.getElementById('historyDate');
  if (historyDate) historyDate.addEventListener('change', () => loadHistory());

}

document.addEventListener('DOMContentLoaded', attachEventHandlers);
// Expose helpers for inline event handlers
window.mostrarReporteMensual = mostrarReporteMensual;
window.mostrarReporteLlegadas = mostrarReporteLlegadas;
window.abrirReportePersonal = abrirReportePersonal;
window.abrirReporte = abrirReporte;
window.loadSecurityLogs = loadSecurityLogs;
window.loadSecurityStats = loadSecurityStats;
window.exportLogs = exportLogs;

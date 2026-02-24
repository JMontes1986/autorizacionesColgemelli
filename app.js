       // Módulos ES6 externos: ui_utils, dashboard, api_client y auth
      // Las funciones globales se registran en window desde /modules/*.js

     // Configuración de Supabase y app centralizada desde módulos ES6
        const appConfig = window.appConfig || {};
        const envExists = !!appConfig.envExists;

        if (!envExists) {
            updateConnectionStatus(false, 'Configuración no encontrada');
            console.error('❌ process.env no disponible. Configuración no encontrada');
        }

        const SUPABASE_URL = appConfig.SUPABASE_URL || '';
        const SUPABASE_ANON_KEY = appConfig.SUPABASE_ANON_KEY || '';
        const GROQ_API_KEY = appConfig.GROQ_API_KEY || '';
        const GROQ_API_BASE_URL = appConfig.GROQ_API_BASE_URL || 'https://api.groq.com/openai/v1';
        const GROQ_MODEL = appConfig.GROQ_MODEL || 'openai/gpt-oss-120b';
        const STORAGE_BUCKET = appConfig.STORAGE_BUCKET || 'autorizaciones';
        const EXIT_EDIT_USERS = appConfig.EXIT_EDIT_USERS || [
            'convivencia@colgemelli.edu.co',
            'sistemas@colgemelli.edu.co'
        ];

        let supabaseClient;
        let supabaseInitPromise = null;
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
        let promotionGradesCache = [];
        let promotionStudentsCache = [];
        let adminStudentsCache = [];
        let visitorExitTrackingAvailable = true;
        let visitorEntrySubmitting = false;

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
        // CONFIGURACIÓN GROQ (CHAT COMPLETIONS)
        // ========================================

        // FUNCIONES DE AUDITORÍA MEJORADAS
        // ========================================

        async function logSecurityEvent(type, action, details = {}, success = true) {
            try {
                if (!supabaseClient) {
                    return;
                }

                const { data: authSession } = await supabaseClient.auth.getSession();
                if (!authSession?.session?.access_token) {
                    return;
                }
                    
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

                 const { error } = await supabaseClient
                    .from('audit_logs')
                    .insert([logEntry]);

                    if (error) {
                    throw error;
                }
                    
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
                if (supabaseClient) {
                // Restaurar referencia global (puede haberse limpiado en logout)
                globalThis.supabaseClient = supabaseClient;
                return true;
            }

            if (supabaseInitPromise) {
                return supabaseInitPromise;
            }

            supabaseInitPromise = (async () => {
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

                 // Exponer referencia global para módulos extraídos (ej. dashboardModule)
                globalThis.supabaseClient = supabaseClient;
                   
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
            })();

            return supabaseInitPromise;
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
                supabaseClient = null;
                supabaseInitPromise = null;
                globalThis.supabaseClient = null;
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
                const loginSection = document.getElementById('loginSection');
                loginSection.classList.remove('is-hidden');
                loginSection.style.display = 'flex';
                document.getElementById('dashboard').style.display = 'none';
                document.body.classList.add('login-active');
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
            if (Notification.permission === 'granted') return;
            if (Notification.permission === 'denied') {
                console.info('🔕 Notificaciones bloqueadas por el navegador.');
                return;
            }
                
            try {
                Notification.requestPermission().then(permission => {
                    console.log('🔔 Permiso de notificación:', permission);
                });
            } catch (e) {
                console.error('Error solicitando permiso de notificación:', e);
                    
            }
        }
        function setupNotificationPermissionRequest() {
            if (!('Notification' in window)) return;
            if (Notification.permission !== 'default') return;

            const requestOnce = () => {
                requestNotificationPermission();
                document.removeEventListener('click', requestOnce);
                document.removeEventListener('keydown', requestOnce);
            };

            document.addEventListener('click', requestOnce, { once: true });
            document.addEventListener('keydown', requestOnce, { once: true });
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

        const LATE_ARRIVAL_WARNING_THRESHOLD = 3;
        const LATE_ARRIVAL_WARNING_DAYS = 7;
        const LATE_ARRIVAL_ALERT_EMAILS = ['sistemas@colgemelli.edu.co', 'convivencia@colgemelli.edu.co'];

        function getColombiaDateFromDate(date) {
            return date.toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
        }

        function getColombiaDateDaysAgo(daysAgo) {
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            return getColombiaDateFromDate(date);
        }

        async function loadLateStudents() {
            const studentList = document.getElementById('lateStudentList');
            const studentSelect = document.getElementById('lateStudentSelect');
            const gradeId = document.getElementById('lateGradeSelect').value;

            if (!gradeId) {
                studentList.innerHTML = '';
                studentList.dataset.disabled = 'true';
                await checkLateArrivalWarnings(getSelectedLateStudents());
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
                await loadLateArrivalHistory();

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
                await loadLateArrivalHistory();
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

        function getMonthRange(dateString) {
            const monthStart = `${dateString.slice(0, 7)}-01`;
            const date = new Date(`${dateString}T00:00:00-05:00`);
            const monthEndDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const monthEnd = monthEndDate.toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
            return { monthStart, monthEnd };
        }

        function getSelectedLateStudents() {
            const selected = Array.from(document.querySelectorAll('#lateStudentList input:checked'));
            return selected.map((checkbox) => ({
                id: checkbox.value,
                name: checkbox.dataset.name || 'Estudiante'
            }));
        }

        function renderLateArrivalWarnings(warnings, startDate, endDate) {
            const warningDiv = document.getElementById('lateArrivalWarning');
            if (!warningDiv) return;

            if (!warnings || warnings.length === 0) {
                warningDiv.style.visibility = 'hidden';
                warningDiv.innerHTML = '';
                return;
            }

            const warningList = warnings.map((student) => `
                <li><strong>${sanitizeHtml(student.name)}</strong>: ${student.count} llegadas tarde</li>
            `).join('');

            const subject = `Advertencia de llegadas tarde (${formatDate(startDate)} - ${formatDate(endDate)})`;
            const body = warnings.map((student) => `- ${student.name}: ${student.count} llegadas tarde`).join('\n');
            const mailto = `mailto:${LATE_ARRIVAL_ALERT_EMAILS.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

            warningDiv.innerHTML = `
                <div class="mb-2"><strong>⚠️ Advertencia semanal de llegadas tarde</strong></div>
                <p class="mb-2">Se detectaron estudiantes con varias llegadas tarde en la última semana:</p>
                <ul class="mb-2">${warningList}</ul>
                <p class="mb-0">
                  Notificar a: ${LATE_ARRIVAL_ALERT_EMAILS.map(email => `<a href="mailto:${email}">${email}</a>`).join(', ')}.
                  <a href="${mailto}" class="ms-1">Enviar advertencia</a>
                </p>
            `;
            warningDiv.style.visibility = 'visible';
        }

        async function checkLateArrivalWarnings(selectedStudents) {
            const warningDiv = document.getElementById('lateArrivalWarning');
            if (!warningDiv) return;

            if (!selectedStudents || selectedStudents.length === 0) {
                warningDiv.style.visibility = 'hidden';
                warningDiv.innerHTML = '';
                return;
            }

            try {
                if (!validateSession()) return;

                const endDate = getColombiaDate();
                const startDate = getColombiaDateDaysAgo(LATE_ARRIVAL_WARNING_DAYS - 1);
                const studentIds = selectedStudents.map((student) => student.id);

                const { data: arrivals, error } = await supabaseClient
                    .from('llegadas_tarde')
                    .select('estudiante_id')
                    .in('estudiante_id', studentIds)
                    .gte('fecha', startDate)
                    .lte('fecha', endDate);

                if (error) throw error;

                const counts = new Map();
                (arrivals || []).forEach((arrival) => {
                    if (!arrival.estudiante_id) return;
                    counts.set(arrival.estudiante_id, (counts.get(arrival.estudiante_id) || 0) + 1);
                });

                const warnings = selectedStudents
                    .map((student) => ({
                        ...student,
                        count: counts.get(student.id) || 0
                    }))
                    .filter((student) => student.count >= LATE_ARRIVAL_WARNING_THRESHOLD);

                renderLateArrivalWarnings(warnings, startDate, endDate);
            } catch (error) {
                console.error('Error al evaluar advertencias de llegadas tarde:', error);
                warningDiv.style.visibility = 'hidden';
                warningDiv.innerHTML = '';
                await logSecurityEvent('error', 'Error al evaluar advertencias de llegadas tarde', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        function getLateHistoryRange() {
            const startInput = document.getElementById('lateHistoryStart');
            const endInput = document.getElementById('lateHistoryEnd');
            if (!startInput || !endInput) return null;
            const startDate = startInput.value;
            const endDate = endInput.value;
            if (!startDate || !endDate) return null;
            return { startDate, endDate };
        }

        function setLateHistoryDateRange(startDate, endDate) {
            const startInput = document.getElementById('lateHistoryStart');
            const endInput = document.getElementById('lateHistoryEnd');
            if (startInput) startInput.value = startDate;
            if (endInput) endInput.value = endDate;
        }

        async function loadLateArrivalHistory() {
            const summary = document.getElementById('lateHistorySummary');
            const tableBody = document.querySelector('#lateHistoryTable tbody');
            if (!summary || !tableBody) return;

            const selectedStudents = getSelectedLateStudents();
            if (selectedStudents.length === 0) {
                summary.innerHTML = '<p class="text-muted mb-0">Selecciona estudiantes para ver el historial.</p>';
                tableBody.innerHTML = '';
                return;
            }

            const range = getLateHistoryRange();
            if (!range) {
                summary.innerHTML = '<p class="text-muted mb-0">Define un período para consultar el historial.</p>';
                tableBody.innerHTML = '';
                return;
            }

            const { startDate, endDate } = range;
            if (startDate > endDate) {
                summary.innerHTML = '<p class="text-danger mb-0">El inicio del período no puede ser posterior a la fecha final.</p>';
                tableBody.innerHTML = '';
                return;
            }

            summary.innerHTML = '<p class="text-muted mb-0">Consultando historial...</p>';
            tableBody.innerHTML = '';

            try {
                if (!validateSession()) return;

                const today = getColombiaDate();
                const { monthStart, monthEnd } = getMonthRange(today);
                const overallStart = startDate < monthStart ? startDate : monthStart;
                const overallEnd = endDate > monthEnd ? endDate : monthEnd;
                const studentIds = selectedStudents.map((student) => student.id);

                const { data: arrivals, error } = await supabaseClient
                    .from('llegadas_tarde')
                    .select('estudiante_id, fecha, excusa')
                    .in('estudiante_id', studentIds)
                    .gte('fecha', overallStart)
                    .lte('fecha', overallEnd)
                    .order('fecha', { ascending: false });

                if (error) throw error;

                const monthCounts = new Map();
                const periodCounts = new Map();
                const lastArrivalMap = new Map();

                (arrivals || []).forEach((arrival) => {
                    const studentId = arrival.estudiante_id;
                    const fecha = arrival.fecha;
                    if (!studentId || !fecha) return;

                    if (!lastArrivalMap.has(studentId)) {
                        lastArrivalMap.set(studentId, {
                            fecha,
                            excusa: arrival.excusa === true
                        });
                    }

                    if (fecha >= monthStart && fecha <= monthEnd) {
                        monthCounts.set(studentId, (monthCounts.get(studentId) || 0) + 1);
                    }

                    if (fecha >= startDate && fecha <= endDate) {
                        periodCounts.set(studentId, (periodCounts.get(studentId) || 0) + 1);
                    }
                });

                const rowsFragment = document.createDocumentFragment();

                selectedStudents.forEach((student) => {
                    const monthCount = monthCounts.get(student.id) || 0;
                    const periodCount = periodCounts.get(student.id) || 0;
                    const lastArrival = lastArrivalMap.get(student.id);
                    const excuseLabel = lastArrival
                        ? (lastArrival.excusa ? 'Con excusa' : 'Sin excusa')
                        : 'Sin registros';

                       const row = document.createElement('tr');
                    const nameCell = document.createElement('td');
                    const monthCountCell = document.createElement('td');
                    const periodCountCell = document.createElement('td');
                    const lastArrivalCell = document.createElement('td');
                    const excuseCell = document.createElement('td');

                    nameCell.textContent = student.name || '';
                    monthCountCell.textContent = String(monthCount);
                    periodCountCell.textContent = String(periodCount);
                    lastArrivalCell.textContent = lastArrival ? formatDate(lastArrival.fecha) : 'Sin registros';
                    excuseCell.textContent = excuseLabel;

                    row.appendChild(nameCell);
                    row.appendChild(monthCountCell);
                    row.appendChild(periodCountCell);
                    row.appendChild(lastArrivalCell);
                    row.appendChild(excuseCell);
                    rowsFragment.appendChild(row);
                });

                tableBody.textContent = '';
                tableBody.appendChild(rowsFragment);

                summary.innerHTML = `
                    <p class="mb-0">
                      Mostrando ${selectedStudents.length} estudiante(s).
                      <strong>Mes actual:</strong> ${formatDate(monthStart)} - ${formatDate(monthEnd)}.
                      <strong>Período:</strong> ${formatDate(startDate)} - ${formatDate(endDate)}.
                    </p>
                `;
                await checkLateArrivalWarnings(selectedStudents);
            } catch (error) {
                console.error('Error loading late arrival history:', error);
                summary.innerHTML = '<p class="text-danger mb-0">No se pudo cargar el historial de llegadas tarde.</p>';
                tableBody.innerHTML = '';
                await logSecurityEvent('error', 'Error al cargar historial de llegadas tarde', {
                    error: error.message.substring(0, 200)
                }, false);
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
            const loginSection = document.getElementById('loginSection');
            loginSection.classList.add('is-hidden');
            loginSection.style.display = 'none';
            document.getElementById('dashboard').style.display = 'flex';
            document.body.classList.remove('login-active');
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) logoutBtn.style.display = 'block';

            setupNavigation();
            loadInitialData();
            resetSessionTimeout();
        }

        function setupNavigation() {
            const navButtons = document.getElementById('navButtons');
            const navButtonsMobile = document.getElementById('navButtonsMobile');
            const role = currentUser.rol.nombre;
            const email = currentUser.email;
            const lateUser =
                email === 'convivencia@colgemelli.edu.co' ||
                email === 'sistemas@colgemelli.edu.co' ||
                email === 'gformativa@colgemelli.edu.co';
            const lateBtnHtml = lateUser ?
                `<button id="lateArrivalBtn" class="btn btn-danger" data-label="Llegadas Tarde" onclick="showSection('lateArrivalSectionDiv')">
                  <span class="nav-icon">⏰</span>
                  <span class="nav-text">Llegadas Tarde</span>
                </button>` : '';
           const logoutButtonHtml = `
                <button class="btn btn-outline-danger" data-label="Cerrar Sesión" id="logoutNavBtn" type="button">
                  <span class="nav-icon">🚪</span>
                  <span class="nav-text">Cerrar Sesión</span>
                </button>
            `; 
           const setNavButtonsContent = (html) => {
                if (navButtons) {
                    navButtons.innerHTML = html;
                }
                if (navButtonsMobile) {
                   navButtonsMobile.innerHTML = `${html}${logoutButtonHtml}`;
                }
            };
            setNavButtonsContent('');

            if (role === 'administrador') {
                setNavButtonsContent(`
                ${lateBtnHtml}
                    <button class="btn" data-label="Dashboard" onclick="showSection('dashboardSectionDiv')">
                      <span class="nav-icon">📊</span>
                      <span class="nav-text">Dashboard</span>
                    </button>
                    <button class="btn" data-label="Autorizar Salidas" onclick="showSection('authorizeSectionDiv')">
                      <span class="nav-icon">🚪</span>
                      <span class="nav-text">Autorizar Salidas</span>
                    </button>
                    <button class="btn" data-label="Autorizar Personal" onclick="showSection('authorizeStaffSectionDiv')">
                      <span class="nav-icon">👥</span>
                      <span class="nav-text">Autorizar Personal</span>
                    </button>
                    <button class="btn" data-label="Visitantes" onclick="showSection('visitorEntrySectionDiv')">
                      <span class="nav-icon">🧾</span>
                      <span class="nav-text">Visitantes</span>
                    </button>
                    <button class="btn" data-label="Administración" onclick="showSection('adminSectionDiv')">
                      <span class="nav-icon">⚙️</span>
                      <span class="nav-text">Administración</span>
                    </button>
                    <button class="btn" data-label="Historial" onclick="showSection('historySectionDiv')">
                      <span class="nav-icon">🕒</span>
                      <span class="nav-text">Historial</span>
                    </button>
                    <button class="btn" data-label="Verificar Salidas" onclick="showSection('verifySectionDiv')">
                      <span class="nav-icon">🛂</span>
                      <span class="nav-text">Verificar Salidas</span>
                    </button>
                `);
            } else if (role === 'talento_humano') {
                const staffReportButton = email === 'gadministrativa@colgemelli.edu.co'
                    ? `<button class="btn" data-label="Reporte Personal" onclick="abrirReportePersonal()">
                        <span class="nav-icon">👥</span>
                        <span class="nav-text">Reporte Personal</span>
                      </button>`
                    : '';
                    
                setNavButtonsContent(`
                    <button class="btn" data-label="Autorizar Personal" onclick="showSection('authorizeStaffSectionDiv')">
                      <span class="nav-icon">👥</span>
                      <span class="nav-text">Autorizar Personal</span>
                    </button>
                    <button class="btn" data-label="Historial" onclick="showSection('historySectionDiv')">
                      <span class="nav-icon">🕒</span>
                      <span class="nav-text">Historial</span>
                    </button>
                    ${staffReportButton}
                `);
            } else if (role === 'vigilante' || email === 'vigilancia@colgemelli.edu.co') {
                setNavButtonsContent(`
                ${lateBtnHtml}
                    <button class="btn" data-label="Dashboard" onclick="showSection('dashboardSectionDiv')">
                      <span class="nav-icon">📊</span>
                      <span class="nav-text">Dashboard</span>
                    </button>
                    <button class="btn" data-label="Control de Salidas" onclick="showSection('verifySectionDiv')">
                      <span class="nav-icon">🛂</span>
                      <span class="nav-text">Control de Salidas</span>
                    </button>
                    <button class="btn" data-label="Visitantes" onclick="showSection('visitorEntrySectionDiv')">
                      <span class="nav-icon">🧾</span>
                      <span class="nav-text">Visitantes</span>
                    </button>
                    <button class="btn" data-label="Historial" onclick="showSection('historySectionDiv')">
                      <span class="nav-icon">🕒</span>
                      <span class="nav-text">Historial</span>
                    </button>
                `);
            } else if (email === 'convivencia@colgemelli.edu.co' || email === 'gformativa@colgemelli.edu.co') {
                // Dashboard especial para convivencia y gestión formativa
                setNavButtonsContent(`
                ${lateBtnHtml}
                    <button class="btn" data-label="Dashboard" onclick="showSection('dashboardSectionDiv')">
                      <span class="nav-icon">📊</span>
                      <span class="nav-text">Dashboard</span>
                    </button>
                    <button class="btn" data-label="Autorizar Salidas" onclick="showSection('authorizeSectionDiv')">
                      <span class="nav-icon">🚪</span>
                      <span class="nav-text">Autorizar Salidas</span>
                    </button>
                    <button class="btn" data-label="Control de Salidas" id="btnControlSalidas" onclick="showSection('verifySectionDiv')">
                      <span class="nav-icon">🛂</span>
                      <span class="nav-text">Control de Salidas</span>
                    </button>
                    <button class="btn" data-label="Historial" onclick="showSection('historySectionDiv')">
                      <span class="nav-icon">🕒</span>
                      <span class="nav-text">Historial</span>
                    </button>
                `);
            } else if (email === 'enfermeria@colgemelli.edu.co') {
                // Enfermería NO tiene acceso al dashboard
                setNavButtonsContent(`
                ${lateBtnHtml}
                    <button class="btn" data-label="Autorizar Salidas" onclick="showSection('authorizeSectionDiv')">
                      <span class="nav-icon">🚪</span>
                      <span class="nav-text">Autorizar Salidas</span>
                    </button>
                    <button class="btn" data-label="Historial" onclick="showSection('historySectionDiv')">
                      <span class="nav-icon">🕒</span>
                      <span class="nav-text">Historial</span>
                    </button>
                `);
            } else {
                // Todos los demás usuarios tienen acceso al dashboard
                setNavButtonsContent(`
                ${lateBtnHtml}
                    <button class="btn" data-label="Dashboard" onclick="showSection('dashboardSectionDiv')">
                      <span class="nav-icon">📊</span>
                      <span class="nav-text">Dashboard</span>
                    </button>
                    <button class="btn" data-label="Autorizar Salidas" onclick="showSection('authorizeSectionDiv')">
                      <span class="nav-icon">🚪</span>
                      <span class="nav-text">Autorizar Salidas</span>
                    </button>
                    <button class="btn" data-label="Historial" onclick="showSection('historySectionDiv')"
                      <span class="nav-icon">🕒</span>
                      <span class="nav-text">Historial</span>
                    </button>
                `);
            }

             const logoutNavBtn = document.getElementById('logoutNavBtn');
            if (logoutNavBtn) {
                logoutNavBtn.addEventListener('click', logout);
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
                
           const visitorReportBtn = document.getElementById('visitorReportBtn');
            if (visitorReportBtn) {
                const allowedVisitorReportUsers = [
                    'sistemas@colgemelli.edu.co',
                    'vigilancia@colgemelli.edu.co'
                ];
                visitorReportBtn.style.display = allowedVisitorReportUsers.includes(email) ? 'inline-block' : 'none';
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

        function setSidebarCollapsedState(isCollapsed) {
            const appShell = document.querySelector('.app-shell');
            if (!appShell) return;
            appShell.classList.toggle('sidebar-collapsed', isCollapsed);
            const collapseBtn = document.getElementById('sidebarCollapseBtn');
            if (collapseBtn) {
                collapseBtn.textContent = isCollapsed ? '⮞' : '⮜';
                collapseBtn.setAttribute('aria-label', isCollapsed ? 'Expandir menú' : 'Colapsar menú');
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
                const historyStart = document.getElementById('lateHistoryStart');
                const historyEnd = document.getElementById('lateHistoryEnd');
                const historyRefresh = document.getElementById('lateHistoryRefresh');
                const historyReset = document.getElementById('lateHistoryReset');
                const studentList = document.getElementById('lateStudentList');
                if (gradeSel && !gradeSel.dataset.bound) {
                    gradeSel.addEventListener('change', loadLateStudents);
                    gradeSel.dataset.bound = 'true';
                }
                if (form && !form.dataset.bound) {
                    form.addEventListener('submit', saveLateArrival);
                    form.dataset.bound = 'true';
                }
                if (historyStart && historyEnd && !historyStart.value && !historyEnd.value) {
                    const today = getColombiaDate();
                    const { monthStart } = getMonthRange(today);
                    setLateHistoryDateRange(monthStart, today);
                }
                if (historyRefresh && !historyRefresh.dataset.bound) {
                    historyRefresh.addEventListener('click', loadLateArrivalHistory);
                    historyRefresh.dataset.bound = 'true';
                }
                if (historyReset && !historyReset.dataset.bound) {
                    historyReset.addEventListener('click', () => {
                        const today = getColombiaDate();
                        const { monthStart } = getMonthRange(today);
                        setLateHistoryDateRange(monthStart, today);
                        loadLateArrivalHistory();
                    });
                    historyReset.dataset.bound = 'true';
                }
                if (historyStart && !historyStart.dataset.bound) {
                    historyStart.addEventListener('change', loadLateArrivalHistory);
                    historyStart.dataset.bound = 'true';
                }
                if (historyEnd && !historyEnd.dataset.bound) {
                    historyEnd.addEventListener('change', loadLateArrivalHistory);
                    historyEnd.dataset.bound = 'true';
                }
                if (studentList && !studentList.dataset.bound) {
                    studentList.addEventListener('change', (event) => {
                        if (event.target && event.target.matches('input[type="checkbox"]')) {
                            loadLateArrivalHistory();
                        }
                    });
                    studentList.dataset.bound = 'true';
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
                        const loadDashboardFn = window.dashboardModule?.loadDashboard || window.loadDashboard;
                        if (typeof loadDashboardFn !== 'function') {
                            throw new ReferenceError('loadDashboard is not available in window.dashboardModule');
                        }
                        await loadDashboardFn();
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
            if (visitorForm && visitorForm.dataset.submitBound !== 'true') {
                visitorForm.addEventListener('submit', saveVisitorEntry);
                visitorForm.dataset.submitBound = 'true';
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
            const staffHasReturnButton = document.getElementById('staffHasReturnButton');
            if (staffHasReturn) {
                staffHasReturn.addEventListener('change', () => {
                    toggleStaffReturnFields(staffHasReturn.checked);
                });
                toggleStaffReturnFields(staffHasReturn.checked);
            }  
            if (staffHasReturnButton && staffHasReturn) {
                staffHasReturnButton.addEventListener('click', () => {
                    staffHasReturn.checked = !staffHasReturn.checked;
                    toggleStaffReturnFields(staffHasReturn.checked);
                });
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

                adminStudentsCache = students || [];
                applyAdminStudentsFilter();
                
            } catch (error) {
                console.error('Error loading students:', error);
                await logSecurityEvent('error', 'Error al cargar estudiantes', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }
        
            function applyAdminStudentsFilter() {
            const searchInput = document.getElementById('adminStudentSearch');
            if (!searchInput) {
                updateStudentsTable(adminStudentsCache);
                return;
            }

            const term = searchInput.value.trim().toLowerCase();
            if (!term) {
                updateStudentsTable(adminStudentsCache);
                return;
            }

            const filtered = adminStudentsCache.filter(student => {
                const nombre = student.nombre ? student.nombre.toLowerCase() : '';
                const apellidos = student.apellidos ? student.apellidos.toLowerCase() : '';
                const documento = student.documento ? String(student.documento).toLowerCase() : '';
                const grado = student.grado?.nombre ? student.grado.nombre.toLowerCase() : '';
                return (
                    nombre.includes(term) ||
                    apellidos.includes(term) ||
                    documento.includes(term) ||
                    grado.includes(term)
                );
            });

        updateStudentsTable(filtered);
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

               // Cargar todos los vigilantes activos para seleccionar quién da el ingreso
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

                    if (currentUser?.id) {
                    select.value = currentUser.id;
                }
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
                                    
                const selectAttempts = [
                    {
                        label: 'full',
                        select: `
                            id,
                            fecha,
                            hora,
                            motivo,
                            observaciones,
                            salida_efectiva,
                            salida_observaciones,
                            created_at,
                            vigilante_id,
                            salida_vigilante_id,
                            area_id,
                            estado_id
                        `,
                        orderColumn: 'created_at'
                    },
                    {
                        label: 'fallback',
                        select: `
                            id,
                            fecha,
                            hora,
                            motivo,
                            observaciones,
                            salida_efectiva,
                            salida_observaciones,
                            vigilante_id,
                            salida_vigilante_id,
                            area_id,
                            estado_id
                        `,
                        orderColumn: 'fecha'
                    },
                    {
                        label: 'minimal',
                        select: `
                            id,
                            fecha,
                            hora,
                            motivo,
                            observaciones
                        `,
                        orderColumn: 'fecha'
                    }
                ];

                let data = null;
                let lastError = null;

                for (const attempt of selectAttempts) {
                    const { data: attemptData, error } = await supabaseClient
                        .from('ingresos_visitantes')
                        .select(attempt.select)
                        .eq('visitante_id', visitorId)
                        .order(attempt.orderColumn, { ascending: false })
                        .limit(10);

                    if (error) {
                        lastError = error;
                        console.warn(`Error loading visitor history (${attempt.label}), retrying:`, error);
                        continue;
                    }

                    data = attemptData;
                    lastError = null;
                    break;
                }

                if (lastError) {
                    throw lastError;
                }

                const historyRecords = data || [];
                if (!historyRecords.length) {
                    renderVisitorHistory([]);
                    return;
                }

                const areaIds = new Set();
                const statusIds = new Set();
                const guardIds = new Set();

                historyRecords.forEach(record => {
                    if (record.area_id) areaIds.add(record.area_id);
                    if (record.estado_id) statusIds.add(record.estado_id);
                    if (record.vigilante_id) guardIds.add(record.vigilante_id);
                    if (record.salida_vigilante_id) guardIds.add(record.salida_vigilante_id);
                });

                const [areasResult, statusResult, guardsResult] = await Promise.all([
                    areaIds.size
                        ? supabaseClient
                            .from('areas_visitante')
                            .select('id, nombre')
                            .in('id', [...areaIds])
                        : Promise.resolve({ data: [], error: null }),
                    statusIds.size
                        ? supabaseClient
                            .from('estados_visitante')
                            .select('id, nombre')
                            .in('id', [...statusIds])
                        : Promise.resolve({ data: [], error: null }),
                    guardIds.size
                        ? supabaseClient
                            .from('usuarios')
                            .select('id, nombre')
                            .in('id', [...guardIds])
                        : Promise.resolve({ data: [], error: null })
                ]);

                if (areasResult.error) {
                    console.warn('Error loading visitor areas for history:', areasResult.error);
                }
                if (statusResult.error) {
                    console.warn('Error loading visitor statuses for history:', statusResult.error);
                }
                if (guardsResult.error) {
                    console.warn('Error loading visitor guards for history:', guardsResult.error);
                }

                const areaMap = new Map((areasResult.data || []).map(area => [area.id, area]));
                const statusMap = new Map((statusResult.data || []).map(status => [status.id, status]));
                const guardMap = new Map((guardsResult.data || []).map(guard => [guard.id, guard]));

                const enrichedHistory = historyRecords.map(record => ({
                    ...record,
                    area: record.area_id ? areaMap.get(record.area_id) || null : null,
                    estado: record.estado_id ? statusMap.get(record.estado_id) || null : null,
                    vigilante: record.vigilante_id ? guardMap.get(record.vigilante_id) || null : null,
                    salida_vigilante: record.salida_vigilante_id ? guardMap.get(record.salida_vigilante_id) || null : null
                }));

                renderVisitorHistory(enrichedHistory);
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
                const emptyMessage = document.createElement('p');
                emptyMessage.style.color = '#666';
                emptyMessage.textContent = 'No se encontraron ingresos previos.';
                list.replaceChildren(emptyMessage);
                return;
            }

            const fragment = document.createDocumentFragment();

            records.forEach(record => {
                const dateText = formatDate(record.fecha);
                const timeText = record.hora ? ` - 🕒 ${formatTime(record.hora)}` : '';
                const areaText = record.area?.nombre || 'Sin área';
                const statusText = record.estado?.nombre || 'Sin estado';
                const guardText = record.vigilante?.nombre || 'Sin vigilante';
                const motivoText = record.motivo || 'Sin motivo';
                const obsText = record.observaciones || '';
                const exitTime = record.salida_efectiva ? formatDateTime(record.salida_efectiva) : null;
                const exitGuardText = record.salida_vigilante?.nombre || '';
                const exitObsText = record.salida_observaciones || '';

                const entry = document.createElement('div');
                entry.className = 'visitor-entry';

                const header = document.createElement('div');
                header.className = 'visitor-entry-header';
                const dateSpan = document.createElement('span');
                dateSpan.textContent = `📅 ${dateText}${timeText}`;
                const statusSpan = document.createElement('span');
                statusSpan.textContent = statusText;
                header.append(dateSpan, statusSpan);

                const areaMeta = document.createElement('div');
                areaMeta.className = 'visitor-entry-meta';
                const areaLabel = document.createElement('strong');
                areaLabel.textContent = 'Área:';
                areaMeta.append(areaLabel, ` ${areaText}`);

                const motivoMeta = document.createElement('div');
                motivoMeta.className = 'visitor-entry-meta';
                const motivoLabel = document.createElement('strong');
                motivoLabel.textContent = 'Motivo:';
                motivoMeta.append(motivoLabel, ` ${motivoText}`);

                const guardMeta = document.createElement('div');
                guardMeta.className = 'visitor-entry-meta';
                const guardLabel = document.createElement('strong');
                guardLabel.textContent = 'Vigilante:';
                guardMeta.append(guardLabel, ` ${guardText}`);

                entry.append(header, areaMeta, motivoMeta, guardMeta);

                if (obsText) {
                    const obsMeta = document.createElement('div');
                    obsMeta.className = 'visitor-entry-meta';
                    const obsLabel = document.createElement('strong');
                    obsLabel.textContent = 'Observaciones:';
                    obsMeta.append(obsLabel, ` ${obsText}`);
                    entry.append(obsMeta);
                }

                const exitMeta = document.createElement('div');
                exitMeta.className = 'visitor-entry-meta';
                const exitLabel = document.createElement('strong');
                exitLabel.textContent = 'Salida:';
                exitMeta.append(
                    exitLabel,
                    exitTime
                        ? ` ${exitTime}${exitGuardText ? ` · ${exitGuardText}` : ''}`
                        : ' Pendiente'
                );
                entry.append(exitMeta);

                if (exitObsText) {
                    const exitObsMeta = document.createElement('div');
                    exitObsMeta.className = 'visitor-entry-meta';
                    const exitObsLabel = document.createElement('strong');
                    exitObsLabel.textContent = 'Observaciones salida:';
                    exitObsMeta.append(exitObsLabel, ` ${exitObsText}`);
                    entry.append(exitObsMeta);
                }

                fragment.append(entry);
            });

            list.replaceChildren(fragment);
        }

        function renderVisitorObservations(records) {
            const list = document.getElementById('visitorObservationList');
            if (!list) return;

            if (!records.length) {
                const emptyMessage = document.createElement('p');
                emptyMessage.style.color = '#666';
                emptyMessage.textContent = 'No hay observaciones registradas.';
                list.replaceChildren(emptyMessage);
                return;
            }

            const fragment = document.createDocumentFragment();

            records.forEach(record => {
                const dateText = formatDateTime(record.created_at);
                const author = record.registrado_por?.nombre || 'Sin responsable';

                const observation = document.createElement('div');
                observation.className = 'visitor-observation';

                const header = document.createElement('div');
                header.className = 'visitor-entry-header';
                const observationText = document.createElement('span');
                observationText.textContent = `🗒️ ${record.observacion || ''}`;
                header.append(observationText);

                const meta = document.createElement('div');
                meta.className = 'visitor-entry-meta';
                meta.textContent = `📌 ${author} · ${dateText}`;

                observation.append(header, meta);
                fragment.append(observation);
            });

            list.replaceChildren(fragment);
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

            if (visitorEntrySubmitting) {
                showWarning('El registro del ingreso ya está en proceso. Espera un momento.', 'visitorInfo');
                return;
            }

            visitorEntrySubmitting = true;
            const submitButton = event?.target?.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
            }
                
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

                const form = document.getElementById('visitorEntryForm');
                let visitorId = form?.dataset.visitorId || '';

                if (!visitorId) {
                    const { data: existingVisitor, error: lookupError } = await supabaseClient
                        .from('visitantes')
                        .select('id')
                        .eq('documento', documentId)
                        .maybeSingle();

                    if (lookupError) throw lookupError;

                    visitorId = existingVisitor?.id || '';
                }

                if (!visitorId) {
                    const { data: visitorData, error: visitorError } = await supabaseClient
                        .from('visitantes')
                        .insert({
                            documento: documentId,
                            nombre: name,
                            perfil_id: profileId,
                            activo: true
                        })
                        .select('id')
                        .single();

                    if (visitorError) throw visitorError;

                    visitorId = visitorData?.id;
                }

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
                    loadVisitorObservations(visitorId),
                    loadPendingVisitorExits()
                ]);
            } catch (error) {
                console.error('Error saving visitor entry:', error);
                showError('Error al registrar el visitante: ' + error.message, 'visitorError');
                await logSecurityEvent('error', 'Error al registrar visitante', {
                    error: error.message.substring(0, 200)
                }, false);
            } finally {
                visitorEntrySubmitting = false;
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        }

        async function loadPendingVisitorExits() {
            const pendingList = document.getElementById('pendingVisitorExitList');
            if (!pendingList) return;

            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.', 'visitorExitError');
                    logout();
                    return;
                }

                 pendingList.innerHTML = '<div class="card" style="text-align: center; padding: 20px;"><p style="color: #666;">🔄 Cargando personal externo...</p></div>';
                    
                visitorExitTrackingAvailable = true;
                const selectAttempts = [
                    {
                        label: 'withExitTracking',
                        select: `
                            id,
                            fecha,
                            hora,
                            motivo,
                            observaciones,
                            salida_efectiva,
                            visitante:visitantes(id, nombre, documento, perfil:perfiles_visitante(nombre)),
                            area:areas_visitante(nombre),
                            estado:estados_visitante(nombre),
                            vigilante:usuarios!ingresos_visitantes_vigilante_id_fkey(nombre)
                        `,
                        applyFilter: query => query
                    },
                    {
                        label: 'withoutExitTracking',
                        select: `
                            id,
                            fecha,
                            hora,
                            motivo,
                            observaciones,
                            visitante:visitantes(id, nombre, documento, perfil:perfiles_visitante(nombre)),
                            area:areas_visitante(nombre),
                            estado:estados_visitante(nombre),
                            vigilante:usuarios!ingresos_visitantes_vigilante_id_fkey(nombre)
                        `,
                        applyFilter: query => query
                    }
                ];

                let entries = null;
                let lastError = null;

                const isMissingColumnError = (error, columnName) => {
                    if (!error) return false;
                    const messageParts = [error.message, error.details, error.hint]
                        .filter(Boolean)
                        .map(part => part.toString().toLowerCase());
                    const combinedMessage = messageParts.join(' ');
                    const column = columnName.toLowerCase();
                    if (!combinedMessage.includes(column)) return false;
                    if (error.code && ['42703', 'PGRST204'].includes(error.code)) return true;
                    return /does not exist|undefined column|schema cache|no existe/.test(combinedMessage);
                };
                    
                for (const attempt of selectAttempts) {
                    let query = supabaseClient
                        .from('ingresos_visitantes')
                        .select(attempt.select)
                        .order('created_at', { ascending: false });

                    query = attempt.applyFilter(query);

                    const { data, error } = await query;

                    if (error) {
                        lastError = error;
                        if (attempt.label === 'withExitTracking' && isMissingColumnError(error, 'salida_efectiva')) {
                            visitorExitTrackingAvailable = false;
                            console.warn('Exit tracking column missing for visitors, retrying without salida_efectiva.');
                            continue;
                        }
                        throw error;
                    }

                    entries = data;
                    lastError = null;
                    break;
                }

                if (lastError) {
                    throw lastError;
                }

               if (visitorExitTrackingAvailable && entries) {
                    entries = entries.filter(entry => !entry.salida_efectiva);
                }
                    
                if (!entries || entries.length === 0) {
                    pendingList.innerHTML = `
                        <div class="verification-card" style="background: linear-gradient(135deg, #95a5a6, #7f8c8d);">
                            <h3>✅ Sin personal externo pendiente</h3>
                            <p><strong>No hay personas externas dentro del colegio</strong></p>
                        </div>
                    `;
                    return;
                }

                const warningHtml = !visitorExitTrackingAvailable
                    ? `
                        <div class="verification-card not-authorized exit-warning" style="margin-bottom: 20px;">
                            <h3><span class="warning-icon">⚠️</span> Salidas de visitantes no disponibles</h3>
                            <p>El control de salidas está deshabilitado porque falta la columna <strong>salida_efectiva</strong>.</p>
                            <ul>
                                <li>Agrega la columna en la tabla <strong>ingresos_visitantes</strong>.</li>
                                <li>Luego recarga la página para habilitar los botones de salida.</li>
                            </ul>
                        </div>
                    `
                    : '';
                    
                const html = entries.map(entry => {
                    const visitorName = entry.visitante?.nombre ? sanitizeHtml(entry.visitante.nombre) : 'Sin nombre';
                    const visitorDocument = entry.visitante?.documento ? sanitizeHtml(entry.visitante.documento) : 'Sin documento';
                    const visitorProfile = entry.visitante?.perfil?.nombre ? sanitizeHtml(entry.visitante.perfil.nombre) : 'Sin perfil';
                    const areaText = entry.area?.nombre ? sanitizeHtml(entry.area.nombre) : 'Sin área';
                    const statusText = entry.estado?.nombre ? sanitizeHtml(entry.estado.nombre) : 'Sin estado';
                    const guardText = entry.vigilante?.nombre ? sanitizeHtml(entry.vigilante.nombre) : 'Sin vigilante';
                    const entryTime = entry.hora ? formatTime(entry.hora) : 'Hora no registrada';
                    const entryDate = entry.fecha ? formatDate(entry.fecha) : 'Fecha no registrada';
                    const entryReason = entry.motivo ? sanitizeHtml(entry.motivo) : 'Sin motivo';
                    const entryObservations = entry.observaciones ? sanitizeHtml(entry.observaciones) : '';
                    const obsId = `visitor-exit-observations-${entry.id}`;
                    const exitDisabled = !visitorExitTrackingAvailable;
                    const entryIdPayload = JSON.stringify(entry.id);

                    return `
                        <div class="verification-card" style="margin-bottom: 20px;">
                            <h3>👤 ${visitorName}</h3>
                            <div class="verification-card-content">
                                <div class="verification-card-info">
                                    <p><strong>🧾 Documento:</strong> <span class="info-value">${visitorDocument}</span></p>
                                    <p><strong>🏷️ Perfil:</strong> <span class="info-value">${visitorProfile}</span></p>
                                    <p><strong>📍 Área:</strong> <span class="info-value">${areaText}</span></p>
                                    <p><strong>📌 Estado:</strong> <span class="info-value">${statusText}</span></p>
                                </div>
                                <div class="verification-card-info">
                                    <p><strong>🗓️ Ingreso:</strong> <span class="info-value">${entryDate}</span></p>
                                    <p><strong>🕐 Hora de ingreso:</strong> <span class="info-value">${entryTime}</span></p>
                                    <p><strong>📝 Motivo:</strong> <span class="info-value">${entryReason}</span></p>
                                    <p><strong>🛡️ Vigilante:</strong> <span class="info-value">${guardText}</span></p>
                                </div>
                            </div>
                            ${entryObservations ? `<div class="verification-card-obs"><strong>📝 Observaciones ingreso:</strong><br>${entryObservations}</div>` : ''}
                            <div class="form-group" style="margin-top: 15px;">
                                <label for="${obsId}">Observaciones de salida (opcional)</label>
                                <textarea id="${obsId}" maxlength="500" oninput="validateTextInput(this)" placeholder="Observaciones opcionales sobre la salida..." rows="2" ${exitDisabled ? 'disabled' : ''}></textarea>
                            </div>
                            <button class="btn btn-success" onclick="confirmVisitorExit(${entryIdPayload})" style="font-size: 16px; padding: 12px 30px; margin-top: 10px;" ${exitDisabled ? 'disabled' : ''}>
                                ${exitDisabled ? '⚠️ Salida no disponible' : '✅ Registrar salida'}
                            </button>
                        </div>
                    `;
                }).join('');

                pendingList.innerHTML = warningHtml + html;
            } catch (error) {
                console.error('Error loading pending visitor exits:', error);
                showError('Error al cargar personal externo en el colegio: ' + error.message, 'visitorExitError');
                await logSecurityEvent('error', 'Error al cargar salidas pendientes de visitantes', {
                    error: error.message.substring(0, 200)
                }, false);
                pendingList.innerHTML = `
                    <div class="verification-card not-authorized">
                        <h3>❌ Error al cargar</h3>
                        <p>No se pudo cargar el listado de personal externo.</p>
                        <button class="btn btn-secondary" onclick="loadPendingVisitorExits()" style="margin-top: 10px;">
                            🔄 Intentar de nuevo
                        </button>
                    </div>
                `;
            }
        }

        async function confirmVisitorExit(entryId) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.', 'visitorExitError');
                    logout();
                    return;
                }

                if (!visitorExitTrackingAvailable) {
                    showError('No se puede registrar la salida: falta la columna salida_efectiva en la base de datos.', 'visitorExitError');
                    return;
                }

                const normalizedEntryId = entryId?.toString().trim();
                if (!normalizedEntryId) {
                    showError('No se pudo identificar el ingreso del visitante.', 'visitorExitError');
                    return;
                }
                    
                const observationField = document.getElementById(`visitor-exit-observations-${normalizedEntryId}`);
                const observations = observationField?.value.trim() || null;
                    
                const { data: updatedExit, error: updateError } = await supabaseClient
                    .from('ingresos_visitantes')
                    .update({
                        salida_efectiva: getColombiaDateTime(),
                        salida_observaciones: observations,
                        salida_vigilante_id: currentUser?.id || null
                    })
                    .eq('id', normalizedEntryId)
                    .select('id, salida_efectiva')
                    .maybeSingle();

                if (updateError) throw updateError;
                const updatedRow = updatedExit;
                if (!updatedRow?.salida_efectiva) {
                    const { data: existingEntry, error: fetchError } = await supabaseClient
                        .from('ingresos_visitantes')
                        .select('id, salida_efectiva')
                        .eq('id', normalizedEntryId)
                        .maybeSingle();

                    if (fetchError) {
                        throw fetchError;
                    }

                    if (existingEntry?.salida_efectiva) {
                        showError('La salida del visitante ya estaba registrada. Se actualizó la lista.', 'visitorExitError');
                        await loadPendingVisitorExits();
                        return;
                    }
                    
                    if (!existingEntry) {
                        showError('No se encontró el ingreso del visitante. Actualiza la lista e intenta nuevamente.', 'visitorExitError');
                        await loadPendingVisitorExits();
                        return;
                    }
                        
                    throw new Error('No se pudo registrar la salida del visitante. Verifica permisos del usuario o el identificador del ingreso.');
                }
                    
                showSuccess('Salida del visitante registrada correctamente.', 'visitorExitInfo');
                await loadPendingVisitorExits();
            } catch (error) {
                console.error('Error confirming visitor exit:', error);
                showError('Error al registrar la salida del visitante: ' + error.message, 'visitorExitError');
                await logSecurityEvent('error', 'Error al registrar salida de visitante', {
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

        async function loadPromotionSection() {
            try {
                await loadPromotionGrades();
                const gradeSelect = document.getElementById('promotionGradeSelect');
                if (!gradeSelect) return;
                if (!gradeSelect.value) {
                    updatePromotionTargetGradeOptions('');
                    updatePromotionStudentsTable([]);
                } else {
                    updatePromotionTargetGradeOptions(gradeSelect.value);
                    await loadPromotionStudents(gradeSelect.value);
                }
            } catch (error) {
                console.error('Error cargando sección de promoción:', error);
                await logSecurityEvent('error', 'Error al cargar sección de promoción', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al cargar la sección de promoción: ' + error.message);
            }
        }

        async function loadPromotionGrades() {
            try {
                if (!validateSession()) return;

                const { data: grades, error } = await supabaseClient
                    .from('grados')
                    .select('id, nombre, nivel')
                    .eq('activo', true)
                    .order('nivel', { ascending: true });

                if (error) throw error;

                promotionGradesCache = grades || [];
                updatePromotionGradeSelect();
            } catch (error) {
                console.error('Error loading promotion grades:', error);
                await logSecurityEvent('error', 'Error al cargar grados para promoción', {
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        function updatePromotionGradeSelect() {
            const gradeSelect = document.getElementById('promotionGradeSelect');
            if (!gradeSelect) return;

            const currentValue = gradeSelect.value;
            gradeSelect.innerHTML = '<option value="">Seleccionar grado...</option>';

            promotionGradesCache.forEach(grade => {
                const option = document.createElement('option');
                option.value = grade.id;
                option.textContent = sanitizeHtml(`${grade.nombre} - ${grade.nivel}`);
                gradeSelect.appendChild(option);
            });

            if (currentValue) {
                gradeSelect.value = currentValue;
            }
        }

        function getNextPromotionGrade(gradeId) {
            const currentIndex = promotionGradesCache.findIndex(grade => String(grade.id) === String(gradeId));
            if (currentIndex === -1) return null;
            return promotionGradesCache[currentIndex + 1] || null;
        }

        function updatePromotionTargetGradeOptions(gradeId) {
            const targetSelect = document.getElementById('promotionTargetGradeSelect');
            if (!targetSelect) return;

            const previousValue = targetSelect.value;
            targetSelect.innerHTML = '<option value="">Seleccionar grado de destino...</option>';

            promotionGradesCache.forEach(grade => {
                if (gradeId && String(grade.id) === String(gradeId)) return;
                const option = document.createElement('option');
                option.value = grade.id;
                option.textContent = sanitizeHtml(`${grade.nombre} - ${grade.nivel}`);
                targetSelect.appendChild(option);
            });

            if (previousValue && Array.from(targetSelect.options).some(option => option.value === previousValue)) {
                targetSelect.value = previousValue;
                return;
            }

            if (gradeId) {
                const nextGrade = getNextPromotionGrade(gradeId);
                if (nextGrade) {
                    targetSelect.value = String(nextGrade.id);
                }
            }
        }

            function getSelectedPromotionTargetGrade() {
            const targetSelect = document.getElementById('promotionTargetGradeSelect');
            if (!targetSelect || !targetSelect.value) return null;
            return promotionGradesCache.find(grade => String(grade.id) === String(targetSelect.value)) || null;
        }

        async function loadPromotionStudents(gradeId) {
            try {
                if (!validateSession()) return;

                if (!gradeId) {
                    promotionStudentsCache = [];
                    updatePromotionStudentsTable([]);
                    return;
                }

                const { data: students, error } = await supabaseClient
                    .from('estudiantes')
                    .select('id, nombre, apellidos, documento, grado_id')
                    .eq('activo', true)
                    .eq('grado_id', gradeId)
                    .order('apellidos', { ascending: true })
                    .order('nombre', { ascending: true });

                if (error) throw error;

                promotionStudentsCache = students || [];
                updatePromotionStudentsTable(promotionStudentsCache);
            } catch (error) {
                console.error('Error loading promotion students:', error);
                await logSecurityEvent('error', 'Error al cargar estudiantes para promoción', {
                    gradeId,
                    error: error.message.substring(0, 200)
                }, false);
            }
        }

        function updatePromotionStudentsTable(students) {
            const tbody = document.querySelector('#promotionStudentsTable tbody');
            if (!tbody) return;

            tbody.innerHTML = '';

            if (!students || students.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-muted">No hay estudiantes para este grado.</td>
                    </tr>
                `;
                return;
            }

           const targetGrade = getSelectedPromotionTargetGrade();
            const targetGradeLabel = targetGrade
                ? `${sanitizeHtml(targetGrade.nombre)} - ${sanitizeHtml(targetGrade.nivel)}`
                : 'Selecciona grado destino';   
                
        students.forEach((student, index) => {
                const row = tbody.insertRow();
                row.innerHTML = `
                    <td>
                        <input class="form-check-input promotion-student-checkbox" type="checkbox" value="${student.id}">
                    </td>
                    <td>${index + 1}</td>
                    <td>${sanitizeHtml(student.nombre)}</td>
                    <td>${sanitizeHtml(student.apellidos)}</td>
                    <td>${student.documento ? sanitizeHtml(student.documento) : 'N/A'}</td>
                    <td>${targetGradeLabel}</td>
                    <td>
                        <button class="btn btn-outline-danger btn-sm" onclick="deactivatePromotionStudent(${student.id})">Dar de baja</button>
                    </td>
                `;
            });

            setTimeout(() => {
                document.querySelectorAll('.promotion-student-checkbox').forEach(checkbox => {
                    checkbox.addEventListener('change', syncPromotionSelectAll);
                });
                syncPromotionSelectAll();
            }, 0);
        }

        function getSelectedPromotionStudentIds() {
            return Array.from(document.querySelectorAll('.promotion-student-checkbox:checked'))
                .map(checkbox => Number(checkbox.value));
        }

        function syncPromotionSelectAll() {
            const selectAll = document.getElementById('promotionSelectAll');
            if (!selectAll) return;
            const checkboxes = document.querySelectorAll('.promotion-student-checkbox');
            const checked = document.querySelectorAll('.promotion-student-checkbox:checked');
            selectAll.checked = checkboxes.length > 0 && checked.length === checkboxes.length;
            selectAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
        }

        function togglePromotionSelectAll() {
            const selectAll = document.getElementById('promotionSelectAll');
            if (!selectAll) return;
            document.querySelectorAll('.promotion-student-checkbox').forEach(checkbox => {
                checkbox.checked = selectAll.checked;
            });
            syncPromotionSelectAll();
        }

        async function applyPromotionToSelected() {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            const gradeSelect = document.getElementById('promotionGradeSelect');
            if (!gradeSelect || !gradeSelect.value) {
                showError('Selecciona el grado actual para promover estudiantes.');
                return;
            }

            const targetGrade = getSelectedPromotionTargetGrade();
            if (!targetGrade) {
                showError('Selecciona el grado destino para la promoción.');
                return;
            }
                
            const selectedIds = getSelectedPromotionStudentIds();
            if (selectedIds.length === 0) {
                showError('Selecciona al menos un estudiante para promocionar.');
                return;
            }

            if (!confirm(`¿Deseas promover ${selectedIds.length} estudiante(s) al grado ${targetGrade.nombre}?`)) {
                return;
            }

            try {
                const { error } = await supabaseClient
                    .from('estudiantes')
                    .update({ grado_id: targetGrade.id })
                    .in('id', selectedIds);

                if (error) throw error;

                await logSecurityEvent('update', 'Promoción de estudiantes', {
                    gradeFrom: gradeSelect.value,
                    gradeTo: targetGrade.id,
                    studentCount: selectedIds.length
                }, true);

                showSuccess('Estudiantes promovidos exitosamente');
                await loadStudents();
                await loadPromotionStudents(gradeSelect.value);
            } catch (error) {
                await logSecurityEvent('error', 'Error al promocionar estudiantes', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al promocionar estudiantes: ' + error.message);
            }
        }

        async function removeSelectedPromotionStudents() {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            const selectedIds = getSelectedPromotionStudentIds();
            if (selectedIds.length === 0) {
                showError('Selecciona al menos un estudiante para dar de baja.');
                return;
            }

            if (!confirm(`¿Deseas dar de baja ${selectedIds.length} estudiante(s)?`)) {
                return;
            }

            try {
                const { data, error } = await supabaseClient
                    .from('estudiantes')
                    .update({ activo: false })
                    .in('id', selectedIds)
                    .select('id');

                if (error) throw error;

                const updatedIds = (data || []).map(student => student.id);
                if (updatedIds.length === 0) {
                    throw new Error('No se pudo dar de baja a los estudiantes seleccionados. Verifica permisos o estado actual.');
                }

                if (updatedIds.length !== selectedIds.length) {
                    showError('Algunos estudiantes no se pudieron dar de baja. Se actualizará la lista con los cambios confirmados.');
                }
                    
                await logSecurityEvent('delete', 'Estudiantes dados de baja desde promoción', {
                    studentCount: updatedIds.length
                }, true);

                showSuccess('Estudiantes dados de baja exitosamente');
                promotionStudentsCache = promotionStudentsCache.filter(student => !updatedIds.includes(student.id));
                updatePromotionStudentsTable(promotionStudentsCache);
                const gradeSelect = document.getElementById('promotionGradeSelect');
                if (gradeSelect?.value) {
                    await loadPromotionStudents(gradeSelect.value);
                }
                await loadStudents();
            } catch (error) {
                await logSecurityEvent('error', 'Error al dar de baja estudiantes', {
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al dar de baja estudiantes: ' + error.message);
            }
        }

        async function deactivatePromotionStudent(studentId) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            if (!confirm('¿Deseas dar de baja a este estudiante?')) {
                return;
            }

            try {
                const { data, error } = await supabaseClient
                    .from('estudiantes')
                    .update({ activo: false })
                    .eq('id', studentId)
                    .select('id');

                if (error) throw error;
                if (!data || data.length === 0) {
                    throw new Error('No se pudo dar de baja al estudiante. Verifica permisos o estado actual.');
                }

                await logSecurityEvent('delete', 'Estudiante dado de baja desde promoción', {
                    studentId
                }, true);

                showSuccess('Estudiante dado de baja exitosamente');
                promotionStudentsCache = promotionStudentsCache.filter(student => student.id !== studentId);
                updatePromotionStudentsTable(promotionStudentsCache);
                const gradeSelect = document.getElementById('promotionGradeSelect');
                if (gradeSelect?.value) {
                    await loadPromotionStudents(gradeSelect.value);
                }
                await loadStudents();
            } catch (error) {
                await logSecurityEvent('error', 'Error al dar de baja estudiante', {
                    studentId,
                    error: error.message.substring(0, 200)
                }, false);
                showError('Error al dar de baja estudiante: ' + error.message);
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

                if (error) {
                    if (!currentExitAuthId && isPrimaryKeyConflict(error, 'uq_autorizaciones_salida_estudiante_fecha_pendiente')) {
                        const raceMessage = 'Otro usuario registró una salida pendiente para este estudiante mientras guardabas. Se cargaron los datos para editar.';
                        showWarning(raceMessage);

                        const { data: conflictingRecords, error: conflictError } = await supabaseClient
                            .from('autorizaciones_salida')
                            .select('id, motivo_id, fecha_salida, hora_salida, observaciones')
                            .eq('estudiante_id', studentId)
                            .eq('fecha_salida', exitDate)
                            .eq('autorizada', true)
                            .is('salida_efectiva', null)
                            .order('fecha_creacion', { ascending: false })
                            .limit(1);

                        if (!conflictError && conflictingRecords?.length) {
                            const record = conflictingRecords[0];
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
                            }
                        }

                        sendNotification('Salida pendiente existente', raceMessage);
                        return;
                    }
                    throw error;
                }

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
            const button = document.getElementById('staffHasReturnButton');
            const returnGroup = document.getElementById('staffReturnTimeGroup');
            const returnInput = document.getElementById('staffReturnTime');

            const shouldShow = typeof forceValue === 'boolean'
                ? forceValue
                : (checkbox ? checkbox.checked : false);

            if (checkbox && typeof forceValue === 'boolean') {
                checkbox.checked = forceValue;
            }

            if (button) {
                button.classList.toggle('is-active', shouldShow);
                button.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
                button.innerHTML = shouldShow
                    ? '✅ Hora de regreso activa'
                    : '⏱️ Registrar hora de regreso';
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
                const canDeleteStudentExit = (currentUser?.email || '').toLowerCase() === 'sistemas@colgemelli.edu.co';
                let html = `<div style="text-align: center; margin-bottom: 20px; background: rgba(52, 152, 219, 0.1); padding: 15px; border-radius: 5px;">
                    <p style="color: #2c3e50; font-size: 15px; font-weight: bold;">📅 ${formatDate(todayColombia)} - 🕐 ${currentTime} (Hora Colombia)</p>
                </div>`;
                
                matchingAuth.forEach(auth => {
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
                                ${canDeleteStudentExit ? `
                                    <button class="btn btn-danger btn-eliminar" onclick="deleteStudentExit(${auth.id})" style="font-size: 16px; padding: 12px 32px; margin-top: 10px; margin-left: 8px;">
                                        🗑️ BORRAR SALIDA
                                    </button>
                                ` : ''}
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


       function createPendingExitCard(options = {}) {
            const {
                cardClass = '',
                title = '',
                imageSrc,
                imageAlt = '',
                leftInfo = [],
                rightInfo = [],
                footerInfo = [],
                observations = '',
                modification,
                extraFooterText = '',
                primaryAction,
                secondaryAction,
                dataset = {}
            } = options;

            const card = document.createElement('div');
            card.className = `verification-card ${cardClass}`.trim();
            Object.entries(dataset).forEach(([key, value]) => {
                if (value !== undefined && value !== null) card.dataset[key] = String(value);
            });

            const titleEl = document.createElement('h3');
            titleEl.textContent = title;
            card.appendChild(titleEl);

            if (imageSrc) {
                const img = document.createElement('img');
                img.src = imageSrc;
                img.alt = imageAlt;
                img.style.cssText = 'width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 2px solid #fff; margin-bottom: 10px;';
                card.appendChild(img);
            }

            const content = document.createElement('div');
            content.className = 'verification-card-content';
            [leftInfo, rightInfo].forEach(items => {
                const col = document.createElement('div');
                col.className = 'verification-card-info';
                items.forEach(({ label, value }) => {
                    const row = document.createElement('p');
                    const strong = document.createElement('strong');
                    strong.textContent = `${label}:`;
                    const span = document.createElement('span');
                    span.className = 'info-value';
                    span.textContent = value;
                    row.append(strong, document.createTextNode(' '), span);
                    col.appendChild(row);
                });
                content.appendChild(col);
            });
            card.appendChild(content);

            const footer = document.createElement('div');
            footer.className = 'verification-card-footer';

            footerInfo.forEach(({ label, value }) => {
                const row = document.createElement('p');
                const strong = document.createElement('strong');
                strong.textContent = `${label}:`;
                row.append(strong, document.createTextNode(` ${value}`));
                footer.appendChild(row);
            });

            if (observations) {
                const obs = document.createElement('div');
                obs.className = 'verification-card-obs';
                const strong = document.createElement('strong');
                strong.textContent = '📝 Observaciones:';
                obs.append(strong, document.createElement('br'), document.createTextNode(observations));
                footer.appendChild(obs);
            }

            if (modification?.details) {
                const update = document.createElement('div');
                update.className = 'verification-card-update';
                const strong = document.createElement('strong');
                strong.textContent = `🔄 Cambios recientes${modification.by ? ` por ${modification.by}` : ''}`;
                const details = document.createElement('span');
                details.className = 'change-details';
                details.textContent = modification.details;
                update.append(strong, details);
                if (modification.date) {
                    const date = document.createElement('small');
                    date.textContent = `Actualizado el ${modification.date}`;
                    update.appendChild(date);
                }
                footer.appendChild(update);
            }

            if (extraFooterText) {
                const extra = document.createElement('p');
                extra.style.cssText = 'margin-top: 10px; font-weight: 600;';
                extra.textContent = extraFooterText;
                footer.appendChild(extra);
            }

            [primaryAction, secondaryAction].filter(Boolean).forEach(action => {
                const btn = document.createElement('button');
                btn.className = action.className;
                btn.style.cssText = action.style;
                btn.textContent = action.text;
                btn.addEventListener('click', action.onClick);
                footer.appendChild(btn);
            });

            card.appendChild(footer);
            return card;
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
                        .in('id', studentIds)
                        .eq('activo', true),
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

                const activeAuthorizations = authorizations.filter(auth => Boolean(studentMap[auth.estudiante_id]));

                if (activeAuthorizations.length === 0) {
                    const currentTime = getColombiaTime();
                    pendingList.innerHTML = `
                        <div class="verification-card" style="background: linear-gradient(135deg, #95a5a6, #7f8c8d);">
                            <h3>✅ ¡Todo en orden!</h3>
                            <p><strong>No hay salidas pendientes para estudiantes activos</strong></p>
                            <p>Fecha: ${formatDate(todayColombia)} - Hora: ${currentTime}</p>
                        </div>
                    `;
                    return;
                }
                    
                reasonsResult.data?.forEach(reason => {
                    reasonMap[reason.id] = reason;
                });

                usersResult.data?.forEach(user => {
                    userMap[user.id] = user;
                });

                const currentTime = getColombiaTime();
                const canDeleteStudentExit = (currentUser?.email || '').toLowerCase() === 'sistemas@colgemelli.edu.co';
                
                pendingList.textContent = '';
                const summary = document.createElement('div');
                summary.style.cssText = 'text-align: center; margin-bottom: 25px; background: rgba(52, 152, 219, 0.1); padding: 20px; border-radius: 10px;';
                const summaryDate = document.createElement('p');
                summaryDate.style.cssText = 'color: #2c3e50; font-weight: bold; font-size: 16px;';
                summaryDate.textContent = `📅 ${formatDate(todayColombia)} - 🕐 ${currentTime} (Hora Colombia)`;
                const summaryCount = document.createElement('p');
                summaryCount.style.cssText = 'color: #7f8c8d; margin-top: 8px;';
                summaryCount.textContent = `Salidas pendientes de confirmación: ${activeAuthorizations.length}`;
                summary.append(summaryDate, summaryCount);
                pendingList.appendChild(summary);

                const fragment = document.createDocumentFragment();
                   
                activeAuthorizations.forEach(auth => {
                    const student = studentMap[auth.estudiante_id] || null;
                    const reason = reasonMap[auth.motivo_id] || null;
                    const user = userMap[auth.usuario_autorizador_id] || null;
                    const modifier = auth.usuario_modifico_id ? (userMap[auth.usuario_modifico_id] || null) : null;
                    
                    let cardClass = 'authorized';
                    const authEmail = (user?.email || '').toLowerCase();
                    if (authEmail === 'enfermeria@colgemelli.edu.co') cardClass = 'authorized-enfermeria';
                    else if (authEmail === 'convivencia@colgemelli.edu.co') cardClass = 'authorized-convivencia';
                    else if (authEmail === 'gformativa@colgemelli.edu.co') cardClass = 'authorized-formativa';

                    fragment.appendChild(createPendingExitCard({
                        cardClass,
                        title: '⏳ PENDIENTE CONFIRMAR SALIDA',
                        imageSrc: student?.foto_url || 'assets/img/placeholder-student.png',
                        imageAlt: 'Foto estudiante',
                        leftInfo: [
                            { label: '👨‍🎓 Estudiante', value: student ? `${student.nombre} ${student.apellidos}` : 'No encontrado' },
                            { label: '🎓 Grado', value: student?.grado?.nombre || 'No encontrado' }
                        ],
                        rightInfo: [
                            { label: '📝 Motivo de Salida', value: reason?.nombre || 'No encontrado' },
                            { label: '🕐 Hora Autorizada', value: formatTime(auth.hora_salida) }
                        ],
                        footerInfo: [{ label: '✅ Autorizado por', value: user?.nombre || 'No encontrado' }],
                        observations: auth.observaciones || '',
                        modification: auth.detalle_modificaciones ? {
                            by: modifier?.nombre || '',
                            details: auth.detalle_modificaciones,
                            date: auth.ultima_modificacion ? formatDateTime(auth.ultima_modificacion) : ''
                        } : null,
                        primaryAction: {
                            className: 'btn btn-success',
                            style: 'font-size: 18px; padding: 15px 40px; margin-top: 15px;',
                            text: '✅ CONFIRMAR SALIDA',
                            onClick: () => confirmExit(auth.id)
                        },
                        secondaryAction: canDeleteStudentExit ? {
                            className: 'btn btn-danger btn-eliminar',
                            style: 'font-size: 16px; padding: 12px 32px; margin-top: 10px; margin-left: 8px;',
                            text: '🗑️ BORRAR SALIDA',
                            onClick: () => deleteStudentExit(auth.id)
                        } : null
                    }));
                });

                pendingList.appendChild(fragment);
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
                } finally {
                await loadPendingVisitorExits();
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
                
                pendingList.textContent = '';
                const summary = document.createElement('div');
                summary.style.cssText = 'text-align: center; margin-bottom: 25px; background: rgba(198, 156, 114, 0.25); padding: 20px; border-radius: 10px;';
                const summaryDate = document.createElement('p');
                summaryDate.style.cssText = 'color: #2c3e50; font-weight: bold; font-size: 16px;';
                summaryDate.textContent = `📅 ${formatDate(todayColombia)} - 🕐 ${currentTime} (Hora Colombia)`;
                const summaryCount = document.createElement('p');
                summaryCount.style.cssText = 'color: #7f8c8d; margin-top: 8px;';
                summaryCount.textContent = `Gestiones pendientes del personal: ${totalPending} (Salidas: ${pendingExitAuths.length} • Regresos: ${pendingReturnAuths.length})`;
                summary.append(summaryDate, summaryCount);
                pendingList.appendChild(summary);

                const fragment = document.createDocumentFragment();
                   
                if (pendingExitAuths.length > 0) {
                    const title = document.createElement('h4');
                    title.style.cssText = 'color: #2c3e50; margin: 25px 0 15px 0;';
                    title.textContent = '🚶‍♀️ Salidas por confirmar';
                    fragment.appendChild(title);
                    pendingExitAuths.forEach(auth => {
                        const staff = staffMap[auth.colaborador_id];
                        const reason = reasonMap[auth.motivo_id];
                        const user = userMap[auth.usuario_autorizador_id];
                        const expectedReturn = auth.requiere_regreso
                            ? (auth.hora_regreso_estimada ? formatTime(auth.hora_regreso_estimada) : 'Sin hora definida')
                            : null;

                        fragment.appendChild(createPendingExitCard({
                            cardClass: 'staff-card',
                            title: '⏳ PENDIENTE CONFIRMAR SALIDA',
                            leftInfo: [
                                { label: '👥 Colaborador', value: staff?.nombre || 'No encontrado' },
                                { label: '💼 Cargo', value: staff?.cargo || 'No registrado' }
                            ],
                            rightInfo: [
                                { label: '🧾 Cédula', value: staff?.cedula || 'N/A' },
                                { label: '🕐 Hora autorizada', value: formatTime(auth.hora_salida) },
                                ...(auth.requiere_regreso ? [{ label: '🔁 Hora de regreso', value: expectedReturn }] : [])
                            ],
                            footerInfo: [
                                { label: '✅ Autorizado por', value: user?.nombre || 'No encontrado' },
                                ...(reason?.nombre ? [{ label: '📝 Motivo', value: reason.nombre }] : [])
                            ],
                            observations: auth.observaciones || '',
                            extraFooterText: auth.requiere_regreso ? '🔁 Se debe registrar el regreso cuando vuelva el colaborador.' : '',
                            primaryAction: {
                                className: 'btn btn-success',
                                style: 'font-size: 18px; padding: 15px 40px; margin-top: 15px;',
                                text: '✅ CONFIRMAR SALIDA',
                                onClick: () => confirmStaffExit(auth.id)
                            },
                            dataset: { authId: auth.id, cardType: 'exit' }
                        }));
                    });
                }

                if (pendingReturnAuths.length > 0) {
                    const title = document.createElement('h4');
                    title.style.cssText = 'color: #2c3e50; margin: 35px 0 15px 0;';
                    title.textContent = '🔁 Regresos por registrar';
                    fragment.appendChild(title);
                    pendingReturnAuths.forEach(auth => {
                        const staff = staffMap[auth.colaborador_id];
                        const reason = reasonMap[auth.motivo_id];
                        const user = userMap[auth.usuario_autorizador_id];
                        const exitTime = auth.salida_efectiva ? formatDateTime(auth.salida_efectiva) : formatTime(auth.hora_salida);
                        const expectedReturn = auth.hora_regreso_estimada ? formatTime(auth.hora_regreso_estimada) : 'Sin hora definida';

                        fragment.appendChild(createPendingExitCard({
                            cardClass: 'staff-card return-pending',
                            title: '🔁 PENDIENTE REGISTRAR REGRESO',
                            leftInfo: [
                                { label: '👥 Colaborador', value: staff?.nombre || 'No encontrado' },
                                { label: '💼 Cargo', value: staff?.cargo || 'No registrado' }
                            ],
                            rightInfo: [
                                { label: '🧾 Cédula', value: staff?.cedula || 'N/A' },
                                { label: '✅ Salida confirmada', value: exitTime },
                                { label: '🔁 Hora de regreso', value: expectedReturn }
                            ],
                            footerInfo: [
                                { label: '✅ Autorizado por', value: user?.nombre || 'No encontrado' },
                                ...(reason?.nombre ? [{ label: '📝 Motivo', value: reason.nombre }] : [])
                            ],
                            observations: auth.observaciones || '',
                            extraFooterText: '📝 Registra la hora exacta de regreso al confirmar.',
                            primaryAction: {
                                className: 'btn btn-success',
                                style: 'font-size: 18px; padding: 15px 40px; margin-top: 15px;',
                                text: '✅ REGISTRAR REGRESO',
                                onClick: () => confirmStaffReturn(auth.id)
                            },
                            dataset: { authId: auth.id, cardType: 'return' }
                        }));
                    });
                }
                    
                pendingList.appendChild(fragment);

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

        async function deleteStudentExit(authId) {
            try {
                if (!validateSession()) {
                    showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                    logout();
                    return;
                }

                const userEmail = (currentUser?.email || '').toLowerCase();
                if (userEmail !== 'sistemas@colgemelli.edu.co') {
                    showError('No tienes permisos para borrar salidas de estudiantes.');
                    return;
                }

                const confirmed = confirm('¿Seguro que deseas borrar esta salida del estudiante? Esta acción no se puede deshacer.');
                if (!confirmed) {
                    return;
                }

                const { error } = await supabaseClient
                    .from('autorizaciones_salida')
                    .delete()
                    .eq('id', authId);

                if (error) throw error;

                await logSecurityEvent('delete', 'Salida de estudiante eliminada desde Control de Salidas', {
                    authId,
                    deletedBy: currentUser.id
                }, true);

                showSuccess('Salida eliminada correctamente.');
                await loadPendingExits();

            const searchSection = document.getElementById('searchSection');
                const searchInput = document.getElementById('studentSearch');
                if (searchSection && searchInput && searchSection.style.display !== 'none' && searchInput.value.trim().length >= 3) {
                    await searchStudent();
                }
            } catch (error) {
                await logSecurityEvent('error', 'Error al eliminar salida de estudiante', {
                    authId,
                    error: error.message.substring(0, 200)
                }, false);
                showError('No se pudo eliminar la salida: ' + error.message);
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
            } else if (section === 'promotion') {
                loadPromotionSection();
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

        async function fetchUsersById(userIds) {
            if (!userIds || userIds.length === 0) {
                return {};
            }

            const { data: users, error } = await supabaseClient
                .from('usuarios')
                .select('id, nombre, email')
                .in('id', userIds);

            if (error || !users) {
                console.warn('No se pudieron cargar usuarios para logs:', error);
                return {};
            }

            return users.reduce((acc, user) => {
                acc[user.id] = user;
                return acc;
            }, {});
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
                    .select('*')
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

                const userIds = [...new Set(logs.map(log => log.usuario_id).filter(Boolean))];
                const usersById = await fetchUsersById(userIds);

                logs.forEach(log => {
                    const row = tbody.insertRow();
                    const typeClass = getLogTypeClass(log.tipo);
                    let details = {};
                    const user = log.usuario || usersById[log.usuario_id];
                        
                    try {
                        details = log.detalles ? JSON.parse(log.detalles) : {};
                    } catch (e) {
                        details = { error: 'Error al parsear detalles' };
                    }
                    
                    row.innerHTML = `
                        <td>${formatDateTime(log.timestamp)}</td>
                        <td>${user ? sanitizeHtml(user.nombre) : 'Sistema'}</td>
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
                    .select('*')
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

                const userIds = [...new Set(logs.map(log => log.usuario_id).filter(Boolean))];
                const usersById = await fetchUsersById(userIds);
                const csvContent = generateCSVFromLogs(logs, usersById);
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

        function openModal(modalId, options = {}) {
            if (!validateSession()) {
                showError('Sesión expirada. Por favor, inicia sesión de nuevo.');
                logout();
                return;
            }

            document.getElementById(modalId).style.display = 'block';
            if (!options.keepEditingId) {
                currentEditingId = null;
            }
            
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

        function isPrimaryKeyConflict(error, constraintName) {
            const message = error?.message || '';
            const details = error?.details || '';
            return (
                error?.code === '23505' &&
                (message.includes(constraintName) || details.includes(constraintName))
            );
        }

        async function getNextStudentId() {
            const { data, error } = await supabaseClient
                .from('estudiantes')
                .select('id')
                .order('id', { ascending: false })
                .limit(1);
            if (error) throw error;
            const maxId = data?.[0]?.id ?? 0;
            return maxId + 1;
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
                    showError('El documento debe contener solo números (4-20 dígitos)');
                    return;
                }

                let result;
                    if (!currentEditingId) {
                    let existingStudent = null;
                    let existingError = null;

                    if (documentValue) {
                        ({ data: existingStudent, error: existingError } = await supabaseClient
                            .from('estudiantes')
                            .select('id, nombre, apellidos, documento, grado_id, foto_url')
                            .eq('documento', documentValue)
                            .limit(1));
                    } else {
                        ({ data: existingStudent, error: existingError } = await supabaseClient
                            .from('estudiantes')
                            .select('id, nombre, apellidos, documento, grado_id, foto_url')
                            .eq('nombre', name)
                            .eq('apellidos', lastName)
                            .eq('grado_id', gradeId)
                            .limit(1));
                    }

                    if (existingError) throw existingError;

                    if (existingStudent && existingStudent.length > 0) {
                        const student = existingStudent[0];
                        currentEditingId = student.id;
                        document.getElementById('studentName').value = student.nombre || name;
                        document.getElementById('studentLastName').value = student.apellidos || lastName;
                        document.getElementById('studentDocument').value = student.documento || documentValue || '';
                        document.getElementById('studentGrade').value = student.grado_id || gradeId;
                        const preview = document.getElementById('studentPhotoPreview');
                        if (preview) {
                            preview.src = student.foto_url || 'assets/img/placeholder-student.png';
                        }
                        const duplicateMessage = documentValue
                            ? `El estudiante con documento ${sanitizeHtml(documentValue)} ya existe. Se cargaron los datos para editar.`
                            : `El estudiante ${sanitizeHtml(name)} ${sanitizeHtml(lastName)} ya existe en el grado seleccionado. Se cargaron los datos para editar.`;
                        showWarning(duplicateMessage);
                        return;
                    }
                }
                    
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
                        if (result.error && isPrimaryKeyConflict(result.error, 'estudiantes_pkey')) {
                        const nextId = await getNextStudentId();
                        result = await supabaseClient
                            .from('estudiantes')
                            .insert([{ ...insertData, id: nextId }]);
                        if (!result.error) {
                            console.warn('Secuencia desincronizada al crear estudiante. Se insertó con ID manual:', nextId);
                        }
                    }
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
                const { data: existingGrades, error: existingError } = await supabaseClient
                        .from('grados')
                        .select('id')
                        .eq('nombre', name)
                        .eq('nivel', level)
                        .limit(1);

                    if (existingError) {
                        throw existingError;
                    }

                    if (existingGrades && existingGrades.length > 0) {
                        showError('Ya existe un grado con ese nombre y nivel');
                        return;
                    }
                        
                result = await supabaseClient
                        .from('grados')
                        .insert([{
                            nombre: name,
                            nivel: level,
                            activo: true
                        }]);

                if (result.error && result.error.code === '23505') {
                        const { data: lastGrades, error: lastError } = await supabaseClient
                            .from('grados')
                            .select('id')
                            .order('id', { ascending: false })
                            .limit(1);

                        const lastId = lastGrades?.[0]?.id;
                        const nextId = Number(lastId);

                        if (!lastError && Number.isFinite(nextId)) {
                            result = await supabaseClient
                                .from('grados')
                                .insert([{
                                    id: nextId + 1,
                                    nombre: name,
                                    nivel: level,
                                    activo: true
                                }]);
                        }
                    }
                        
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

                    let visitorQuery = supabaseClient
                    .from('ingresos_visitantes')
                    .select('*')
                    .order('created_at', { ascending: false });
                    
                if (!all) {
                    const date = document.getElementById('historyDate').value;
                    if (date) {
                         console.log('🗓️ Filtrando por fecha específica:', date);
                        studentQuery = studentQuery.eq('fecha_salida', date);
                        staffQuery = staffQuery.eq('fecha_salida', date);
                        visitorQuery = visitorQuery.eq('fecha', date);
                    } else {
                        const todayColombia = getColombiaDate();
                        const thirtyDaysAgo = new Date(todayColombia);
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        const dateLimit = thirtyDaysAgo.toISOString().split('T')[0];
                        console.log('🗓️ Filtrando últimos 30 días desde:', dateLimit, 'hasta:', todayColombia);
                        studentQuery = studentQuery.gte('fecha_salida', dateLimit);
                        staffQuery = staffQuery.gte('fecha_salida', dateLimit);
                        visitorQuery = visitorQuery.gte('fecha', dateLimit);
                    }
                }

               const [studentResult, staffResult, visitorResult] = await Promise.all([
                    role === 'talento_humano' ? Promise.resolve({ data: [] }) : studentQuery,
                    staffQuery,
                    visitorQuery
                ]);

                if (studentResult.error) {
                    console.error('❌ Error en historial de estudiantes:', studentResult.error);
                    throw studentResult.error;
                }
                if (staffResult.error) {
                    console.error('❌ Error en historial de personal:', staffResult.error);
                    throw staffResult.error;
                }

                if (visitorResult.error) {
                    console.error('❌ Error en historial de visitantes:', visitorResult.error);
                    throw visitorResult.error;
                }
                    
                const studentAuths = role === 'talento_humano' ? [] : (studentResult.data || []);
                const staffAuths = staffResult.data || [];
                const visitorAuths = visitorResult.data || [];
                const combinedRecords = [
                    ...studentAuths.map(record => ({ ...record, tipo: 'estudiante' })),
                    ...staffAuths.map(record => ({ ...record, tipo: 'personal' })),
                    ...visitorAuths.map(record => ({ ...record, tipo: 'visitante' }))
                ].sort((a, b) => {
                    const dateA = new Date(a.fecha_creacion || a.created_at || a.salida_efectiva || `${a.fecha_salida || a.fecha}T00:00:00`);
                    const dateB = new Date(b.fecha_creacion || b.created_at || b.salida_efectiva || `${b.fecha_salida || b.fecha}T00:00:00`);
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
                const visitorIds = [...new Set(visitorAuths.map(auth => auth.visitante_id))];
                const reasonIds = [...new Set([
                    ...studentAuths.map(auth => auth.motivo_id),
                    ...staffAuths.map(auth => auth.motivo_id)
                ].filter(Boolean))];
                const visitorAreaIds = [...new Set(visitorAuths.map(auth => auth.area_id).filter(Boolean))];
                const visitorStatusIds = [...new Set(visitorAuths.map(auth => auth.estado_id).filter(Boolean))];
                const visitorGuardIds = [...new Set(visitorAuths.flatMap(auth => [auth.vigilante_id, auth.salida_vigilante_id]).filter(Boolean))];
                const userIds = [...new Set([
                    ...studentAuths.map(auth => auth.usuario_autorizador_id),
                    ...staffAuths.map(auth => auth.usuario_autorizador_id),
                    ...visitorGuardIds
                ])];

                const [studentsResult, staffMembersResult, reasonsResult, usersResult, visitorsResult, visitorAreasResult, visitorStatusesResult] = await Promise.all([
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
                        : Promise.resolve({ data: [] }),
                    visitorIds.length > 0
                        ? supabaseClient
                            .from('visitantes')
                            .select('id, nombre, documento, perfil:perfiles_visitante(nombre)')
                            .in('id', visitorIds)
                        : Promise.resolve({ data: [] }),
                    visitorAreaIds.length > 0
                        ? supabaseClient
                            .from('areas_visitante')
                            .select('id, nombre')
                            .in('id', visitorAreaIds)
                        : Promise.resolve({ data: [] }),
                    visitorStatusIds.length > 0
                        ? supabaseClient
                            .from('estados_visitante')
                            .select('id, nombre')
                            .in('id', visitorStatusIds)
                        : Promise.resolve({ data: [] })
                ]);

                const studentMap = {};
                const staffMap = {};
                const reasonMap = {};
                const userMap = {};
                const visitorMap = {};
                const visitorAreaMap = {};
                const visitorStatusMap = {};

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

                visitorsResult.data?.forEach(visitor => {
                    visitorMap[visitor.id] = visitor;
                });

                visitorAreasResult.data?.forEach(area => {
                    visitorAreaMap[area.id] = area;
                });

                visitorStatusesResult.data?.forEach(status => {
                    visitorStatusMap[status.id] = status;
                });
                    
                const tbody = document.querySelector('#historyTable tbody');
                tbody.innerHTML = '';

                combinedRecords.forEach(record => {
                    const isStaff = record.tipo === 'personal';
                    const isVisitor = record.tipo === 'visitante';
                    const persona = isVisitor
                        ? visitorMap[record.visitante_id]
                        : (isStaff ? staffMap[record.colaborador_id] : studentMap[record.estudiante_id]);
                    const reason = reasonMap[record.motivo_id];
                    const guardId = isVisitor ? (record.salida_vigilante_id || record.vigilante_id) : record.usuario_autorizador_id;
                    const user = userMap[guardId];

                    const personaNombre = isVisitor
                        ? (persona ? sanitizeHtml(persona.nombre) : 'Visitante no encontrado')
                        : (isStaff
                            ? (persona ? sanitizeHtml(persona.nombre) : 'Personal no encontrado')
                            : (persona ? `${sanitizeHtml(persona.nombre)} ${sanitizeHtml(persona.apellidos)}` : 'Estudiante no encontrado'));

                    let detalleTexto;
                    if (isVisitor) {
                        const profile = persona?.perfil?.nombre ? sanitizeHtml(persona.perfil.nombre) : 'Perfil no encontrado';
                        const area = visitorAreaMap[record.area_id]?.nombre ? sanitizeHtml(visitorAreaMap[record.area_id].nombre) : 'Área no registrada';
                        const status = visitorStatusMap[record.estado_id]?.nombre ? sanitizeHtml(visitorStatusMap[record.estado_id].nombre) : 'Estado no registrado';
                        const document = persona?.documento ? sanitizeHtml(persona.documento) : 'Sin documento';
                        detalleTexto = `${profile} • ${area} • ${status} • ${document}`;
                    } else if (isStaff) {
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
                        : (isVisitor ? '⏳ En sitio' : '⏳ Pendiente');

                    let observacionesHtml = '';
                    if (isVisitor) {
                        const obsParts = [];
                        if (record.observaciones) {
                            obsParts.push(`Ingreso: ${sanitizeHtml(record.observaciones)}`);
                        }
                        if (record.salida_observaciones) {
                            obsParts.push(`Salida: ${sanitizeHtml(record.salida_observaciones)}`);
                        }
                        if (obsParts.length > 0) {
                            observacionesHtml = `<br><small style="color: #666;">Obs: ${obsParts.join(' • ')}</small>`;
                        }
                    } else if (record.observaciones) {
                        observacionesHtml = `<br><small style="color: #666;">Obs: ${sanitizeHtml(record.observaciones)}</small>`;
                    }
                    
                    const fechaSalida = isVisitor ? formatDate(record.fecha) : formatDate(record.fecha_salida);
                    const horaSalida = isVisitor ? formatTime(record.hora) : formatTime(record.hora_salida);
                    const motivoTexto = isVisitor
                        ? (record.motivo ? sanitizeHtml(record.motivo) : 'Motivo no registrado')
                        : (reason?.nombre ? sanitizeHtml(reason.nombre) : 'Motivo no encontrado');

                    const row = tbody.insertRow();
                    row.innerHTML = `
                         <td>${isVisitor ? 'Visitante' : (isStaff ? 'Personal' : 'Estudiante')}</td>
                        <td>${personaNombre}</td>
                        <td>${detalleTexto}</td>
                        <td>${motivoTexto}</td>
                        <td>${fechaSalida}</td>
                        <td>${horaSalida}</td>
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

                openModal('studentModal', { keepEditingId: true });
                currentEditingId = id;
                document.getElementById('studentName').value = student.nombre;
                document.getElementById('studentLastName').value = student.apellidos;
                document.getElementById('studentDocument').value = student.documento || '';
                document.getElementById('studentGrade').value = student.grado_id;
                
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
                        .eq('id', id)
                        .select('id');

                    if (error) throw error;
                    if (!data || data.length === 0) {
                        throw new Error('No se pudo dar de baja al estudiante. Verifica permisos o estado actual.');
                    }

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

                openModal('userModal', { keepEditingId: true });
                currentEditingId = id;
                document.getElementById('userName').value = user.nombre;
                document.getElementById('userEmail').value = user.email;
                document.getElementById('userPassword').value = '';
                document.getElementById('userRole').value = user.rol_id;
                
                document.getElementById('passwordNote').textContent = '(dejar vacío para mantener actual)';
                document.getElementById('userPassword').required = false;
                document.getElementById('userPasswordStrength').style.display = 'none';
                
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

                openModal('guardModal', { keepEditingId: true });
                currentEditingId = id;
                document.getElementById('guardName').value = user.nombre;
                document.getElementById('guardEmail').value = user.email;
                document.getElementById('guardPassword').value = '';

                document.getElementById('guardPasswordNote').textContent = '(dejar vacío para mantener actual)';
                document.getElementById('guardPassword').required = false;
                const strength = document.getElementById('guardPasswordStrength');
                if (strength) strength.style.display = 'none';

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

                openModal('visitorProfileModal', { keepEditingId: true });
                currentEditingId = id;
                document.getElementById('visitorProfileName').value = profile.nombre;

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

                openModal('visitorAreaModal', { keepEditingId: true });
                currentEditingId = id;
                document.getElementById('visitorAreaName').value = area.nombre;

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

                openModal('visitorStatusModal', { keepEditingId: true });
                currentEditingId = id;
                document.getElementById('visitorStatusName').value = status.nombre;

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

                openModal('reasonModal', { keepEditingId: true });
                currentEditingId = id;
                document.getElementById('reasonName').value = reason.nombre;
                document.getElementById('reasonDescription').value = reason.descripcion || '';

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

                openModal('gradeModal', { keepEditingId: true });
                currentEditingId = id;
                document.getElementById('gradeName').value = grade.nombre;
                document.getElementById('gradeLevel').value = grade.nivel;

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
        const securityDebugEnabled = new URLSearchParams(window.location.search).has('securityDebug');
        const domAllowlist = {
            ids: new Set(['dashboard', 'dashboardSectionDiv', 'historyDebug', 'securityIndicator']),
            classes: new Set(['toast-container', 'modal', 'tooltip', 'popover', 'dropdown-menu']),
            scriptSrcPatterns: [
                /^https:\/\/cdn\.jsdelivr\.net\//,
                /^https:\/\/cdn\.jsdelivr\.net\/npm\//,
                /^https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\//,
                /^https:\/\/cdn\.jsdelivr\.net\/npm\/crypto-js\//,
                /^https:\/\/cdn\.jsdelivr\.net\/npm\/gsap\//,
                /^https:\/\/cdn\.jsdelivr\.net\/npm\/echarts\//,
                /^https:\/\/cdn\.jsdelivr\.net\/npm\/bootstrap\//,
                /\/(app|env|version|toast)\.js$/
            ]
        };

        const domMonitorRoot = document.getElementById('dashboard')
            || document.querySelector('.app-shell')
            || document.body;

        const isAllowlistedNode = (node) => {
            if (!node || node.nodeType !== 1) {
                return false;
            }

            if (node.id && domAllowlist.ids.has(node.id)) {
                return true;
            }

            if (node.classList) {
                for (const className of domAllowlist.classes) {
                    if (node.classList.contains(className)) {
                        return true;
                    }
                }
            }

            return false;
        };

        const isAllowlistedScript = (script) => {
            if (!script) {
                return false;
            }

            const src = script.getAttribute('src') || '';
            return domAllowlist.scriptSrcPatterns.some((pattern) => pattern.test(src));
        };

        const truncateHtml = (html, limit = 300) => {
            if (!html) {
                return '';
            }

            return html.length > limit ? `${html.slice(0, limit)}…` : html;
        };

        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === 1) { // Element node
                                if (isAllowlistedNode(node)) {
                                return;
                            }
                                
                            const scripts = node.querySelectorAll ? node.querySelectorAll('script') : [];
                            const suspiciousScripts = Array.from(scripts).filter((script) => !isAllowlistedScript(script));

                            if (suspiciousScripts.length > 0) {
                                console.warn('🚨 Intento de inyección de script detectado');
                                if (securityDebugEnabled) {
                                    console.debug('🔎 Nodo sospechoso detectado:', truncateHtml(node.outerHTML));
                                }

                                suspiciousScripts.forEach(script => script.remove());
                                
                                logSecurityEvent('security', 'Intento de inyección DOM detectado', {
                                    element: node.tagName || 'unknown',
                                    scriptsDetected: suspiciousScripts.length
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
           observer.observe(domMonitorRoot, {
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

    // Función legacy: la sección de Control de Salidas ahora se carga con
    // loadPendingExits()/loadPendingStaffExits()/loadPendingVisitorExits().
    // Se mantiene para no romper llamadas existentes.
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
  if (!seccionDashboard || !wrapperHistorico) return;
  if (!seccionDashboard.classList.contains('active')) {
    wrapperHistorico.style.display = 'none';
  }
}

function cerrarMenuMovilSiEstaAbierto() {
  const sidebar = document.getElementById('sidebarMenu');
  if (!sidebar) return;
  if (window.innerWidth >= 992) return;
  if (!sidebar.classList.contains('show')) return;
  if (window.bootstrap && window.bootstrap.Offcanvas) {
    const instance = window.bootstrap.Offcanvas.getInstance(sidebar) || new window.bootstrap.Offcanvas(sidebar);
    instance.hide();
  }
}

// Interceptar todos los clics en los botones de navegación
document.querySelectorAll('.nav-buttons .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setTimeout(actualizarVisibilidadHistorico, 100); // espera pequeña para que cambie la clase
  });
});

document.addEventListener('click', (event) => {
  const target = event.target.closest('.nav-buttons .btn, #logoutBtn, #logoutNavBtn');
  if (!target) return;
  cerrarMenuMovilSiEstaAbierto();
});

document.addEventListener('DOMContentLoaded', function () {
  const collapseBtn = document.getElementById('sidebarCollapseBtn');
  const storedState = localStorage.getItem('sidebarCollapsed');
  if (storedState !== null) {
    setSidebarCollapsedState(storedState === '1');
  }

  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      const appShell = document.querySelector('.app-shell');
      const isCollapsed = appShell ? appShell.classList.contains('sidebar-collapsed') : false;
      const nextState = !isCollapsed;
      setSidebarCollapsedState(nextState);
      localStorage.setItem('sidebarCollapsed', nextState ? '1' : '0');
    });
  }
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

function getDashboardHandler(handlerName) {
    return (...args) => {
        const handler = window.dashboardModule?.[handlerName] || window[handlerName];
        if (typeof handler !== 'function') {
            console.warn(`⚠️ Handler de dashboard no disponible: ${handlerName}`);
            return;
        }
        return handler(...args);
    };
}

function attachEventHandlers() {
    setupNotificationPermissionRequest();
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (event) => {
            event.preventDefault();
            login();
        });
    }
    const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  const clickHandlers = [
    ['#loginBtn', login],
    ['#testConnectionBtn', testConnection],
    ['#loadPendingBtn', loadPendingExits],
    ['#toggleSearchBtn', toggleSearch],
    ['#showMyConfirmedBtn', getDashboardHandler('showMyConfirmedExits')],
    ['#btnAdminStudents', () => showAdminSection('students')],
    ['#btnAdminUsers', () => showAdminSection('users')],
    ['#btnAdminReasons', () => showAdminSection('reasons')],
    ['#btnAdminGrades', () => showAdminSection('grades')],
    ['#btnAdminPromotion', () => showAdminSection('promotion')],
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
    ['#refreshDashboardBtn', getDashboardHandler('refreshDashboard')],
    ['#exportDashboardBtn', getDashboardHandler('exportDashboardData')],
    ['#showDetailedViewBtn', getDashboardHandler('showDetailedView')],
    ['#debugDashboardBtn', getDashboardHandler('debugDashboard')],
    ['#loadLogsBtn', loadSecurityLogs],
    ['#exportLogsBtn', exportLogs],
    ['#cancelEditExitBtn', cancelExitEdit],
    ['#promotionApplyBtn', applyPromotionToSelected],
    ['#promotionRemoveBtn', removeSelectedPromotionStudents]
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

  const promotionGradeSelect = document.getElementById('promotionGradeSelect');
  if (promotionGradeSelect) {
    promotionGradeSelect.addEventListener('change', async () => {
      updatePromotionTargetGradeOptions(promotionGradeSelect.value);
      await loadPromotionStudents(promotionGradeSelect.value);
    });
  }

  const promotionTargetGradeSelect = document.getElementById('promotionTargetGradeSelect');
  if (promotionTargetGradeSelect) {
    promotionTargetGradeSelect.addEventListener('change', () => {
      updatePromotionStudentsTable(promotionStudentsCache);
    });
  }
        
  const promotionSelectAll = document.getElementById('promotionSelectAll');
  if (promotionSelectAll) promotionSelectAll.addEventListener('change', togglePromotionSelectAll);
        
  const observations = document.getElementById('observations');
  if (observations) observations.addEventListener('input', () => validateTextInput(observations));

  const studentSearch = document.getElementById('studentSearch');
  if (studentSearch) studentSearch.addEventListener('input', () => validateSearchInput(studentSearch));

  const adminStudentSearch = document.getElementById('adminStudentSearch');
  if (adminStudentSearch) {
    adminStudentSearch.addEventListener('input', applyAdminStudentsFilter);
  }
  const adminStudentSearchBtn = document.getElementById('adminStudentSearchBtn');
  if (adminStudentSearchBtn) {
    adminStudentSearchBtn.addEventListener('click', applyAdminStudentsFilter);
  }
        
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

  initMobileNavigation();
}

document.addEventListener('DOMContentLoaded', attachEventHandlers);
// Expose helpers for inline event handlers
window.mostrarReporteMensual = (...args) => getDashboardHandler('mostrarReporteMensual')(...args);
window.mostrarReporteLlegadas = (...args) => getDashboardHandler('mostrarReporteLlegadas')(...args);
window.abrirReportePersonal = (...args) => getDashboardHandler('abrirReportePersonal')(...args);
window.abrirReporte = (...args) => getDashboardHandler('abrirReporte')(...args);
window.loadSecurityLogs = loadSecurityLogs;
window.abrirReporteVisitantes = (...args) => getDashboardHandler('abrirReporteVisitantes')(...args);
window.loadSecurityStats = loadSecurityStats;
window.exportLogs = exportLogs;

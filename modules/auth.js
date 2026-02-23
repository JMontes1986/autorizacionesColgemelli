// Autenticación y seguridad extraídas de app.js

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
            
             // Verificar dominio institucional
            if (!email.toLowerCase().endsWith('@colgemelli.edu.co')) return false;
                
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
            
            // Solo números, 4-20 dígitos
            const docPattern = /^[0-9]{4,20}$/;
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
            if (input) {
                input.value = '';
                input.classList.remove('input-secure', 'input-error');
            }
        }

        function validateCaptcha() {
            const input = document.getElementById('captchaAnswer');
           if (!input) {
                showError('No se encontró el campo de validación');
                return false;
            }
            const value = parseInt(input.value, 10);
            if (!Number.isInteger(value) || value !== captchaResult) {
                input.classList.remove('input-secure');
                input.classList.add('input-error');
                input.focus();
                showError('Respuesta incorrecta a la pregunta de seguridad');
                return false;
            }
            input.classList.remove('input-error');
            input.classList.add('input-secure');
            return true;
        }

        function resetCaptcha() {
            generateCaptcha();
        }

        // ========================================

const authApi = {
  generateCSRFToken,
  storeCSRFToken,
  getCSRFToken,
  getOrCreateCSRFToken,
  sanitizeHtml,
  encryptPassword,
  verifyPassword,
  validateEmail,
  validatePassword,
  validateName,
  validateDocument,
  validateText,
  validateEmailInput,
  validatePasswordInput,
  validateNameInput,
  validateDocumentInput,
  validateTextInput,
  validateSearchInput,
  togglePasswordVisibility,
  generateSecureToken,
  saveSessionState,
  clearSessionState,
  restoreSessionState,
  validateSession,
  renewSession,
  checkRateLimit,
  recordFailedAttempt,
  getClientId,
  generateCaptcha,
  validateCaptcha,
  resetCaptcha
};

Object.assign(window, authApi);
window.authModule = authApi;

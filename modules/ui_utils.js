// Utilidades de interfaz y responsive extraídas de app.js

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

        function initMobileNavigation() {
            const mobileButtons = document.querySelectorAll('[data-mobile-target]');
            if (!mobileButtons.length) return;

            mobileButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const targetSelector = button.getAttribute('data-mobile-target');
                    if (!targetSelector) return;

                    const target = document.querySelector(targetSelector);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });
        }

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

/**
         * Renderiza listas masivas usando DocumentFragment para reducir reflows/repaints.
         * @param {Element} container - Nodo contenedor donde se agregan los elementos.
         * @param {Array} items - Datos a renderizar.
         * @param {(item: any, index: number) => Node|Node[]|null} renderer - Función que retorna nodo(s) por ítem.
         * @example
         * renderListWithFragment(tbody, students, (student) => {
         *   const row = document.createElement('tr');
         *   row.innerHTML = `<td>${sanitizeHtml(student.nombre)}</td>`;
         *   return row;
         * });
         */
        function renderListWithFragment(container, items, renderer) {
            if (!container || typeof renderer !== 'function') return;

            const fragment = document.createDocumentFragment();
            const list = Array.isArray(items) ? items : [];

            list.forEach((item, index) => {
                const rendered = renderer(item, index);
                if (!rendered) return;

                if (Array.isArray(rendered)) {
                    rendered.forEach(node => {
                        if (node instanceof Node) fragment.appendChild(node);
                    });
                    return;
                }

                if (rendered instanceof Node) {
                    fragment.appendChild(rendered);
                }
            });

            container.replaceChildren(fragment);
        }

const uiUtilsApi = {
    ensureEChartsLoaded,
    ensureCryptoJSLoaded,
    createSimpleCharts,
    updateSimpleCharts,
    detectDeviceAndAdjustUI,
    adjustTablesForMobile,
    adjustModalsForMobile,
    adjustCardsForMobile,
    adjustNavigationForDevice,
    adjustCaptchaSize,
    initMobileNavigation,
    setupTableScroll,
    updateScrollIndicators,
    scrollToColumn,
    enhanceTouchExperience,
    handleOrientationChange,
    optimizeViewport,
    createMobileQuickActions,
    renderListWithFragment
};

Object.assign(window, uiUtilsApi);
window.uiUtils = uiUtilsApi;

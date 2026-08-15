/* ==========================================================================
   APPLICATION LOGIC (V2 - REAL DB STATE & EVENT-DRIVEN P2P QR CODE VALIDATION)
   ========================================================================== */

// 1. DADOS INICIAIS DO SIMULADOR (DATABASE DEFAULT)
const INITIAL_DATABASE_V2 = {
    empresas: [
        {
            id: "emp_chaves_imoveis",
            nome_fantasia: "Chaves Imóveis",
            razao_social: "Chaves Empreendimentos Imobiliários S/A",
            cnpj: "12.345.678/0001-90",
            status_contrato: "Ativo"
        },
        {
            id: "emp_acme_corp",
            nome_fantasia: "Acme Corp",
            razao_social: "Acme Indústria & Comércio S/A",
            cnpj: "98.765.432/0001-10",
            status_contrato: "Ativo"
        }
    ],
    usuarios: [
        {
            id_usuario: "usr_caua",
            fk_empresa: "emp_chaves_imoveis",
            nome_completo: "Cauã Ferreira",
            matricula: "0109",
            cargo: "Auxiliar de Serviços Administrativos",
            setor: "Contas a Pagar",
            saldo_estrelas: 4,
            status: "Ativo",
            senha: "123456",
            role: "gestor",
            foto: ""
        },
        {
            id_usuario: "usr_maria",
            fk_empresa: "emp_acme_corp",
            nome_completo: "Maria Souza",
            matricula: "0808",
            cargo: "Analista de Operações",
            setor: "Logística",
            saldo_estrelas: 10,
            status: "Ativo",
            senha: "123456",
            role: "colaborador",
            foto: ""
        }
    ],
    comunicados: [
        {
            id: "com_1",
            titulo: "Funcionamento do Refeitório Interno",
            conteudo: "Informamos que no dia 05/07 o refeitório funcionará em horário reduzido (12h às 13h) por conta de manutenção preventiva dos equipamentos.",
            data: "02/07/2026",
            tipo: "operacional",
            pontos: 0
        },
        {
            id: "com_2",
            titulo: "Palestra Janeiro Branco: Saúde Mental",
            conteudo: "Cuidar da mente é o melhor caminho. Participe da palestra interativa de equilíbrio emocional com psicólogos convidados.",
            data: "02/07/2026",
            tipo: "treinamento",
            pontos: 1
        },
        {
            id: "com_3",
            titulo: "NR-10: Segurança em Instalações Elétricas",
            conteudo: "Procedimentos de isolamento, prevenção contra choques e arco elétrico. Curso obrigatório e preventivo.",
            data: "28/06/2026",
            tipo: "treinamento",
            pontos: 1
        }
    ],
    treinamentos: [
        {
            id: "ev_nr35",
            titulo: "Treinamento de NR-35 (Trabalho em Altura)",
            data: "05/07/2026 às 14:00",
            pin: "3535",
            status_por_usuario: { "0109": "registered", "0808": "unregistered" },
            matriculas_validadas: [] // Lista de matrículas que já concluíram o evento
        },
        {
            id: "ev_nr10",
            titulo: "Treinamento de NR-10 (Segurança em Eletricidade)",
            data: "08/07/2026 às 09:00",
            pin: "1010",
            status_por_usuario: { "0109": "unregistered", "0808": "registered" },
            matriculas_validadas: []
        },
        {
            id: "ev_mapeamento",
            titulo: "Mapeamento de Riscos e Ergonomia",
            data: "12/07/2026 às 10:30",
            pin: "2026",
            status_por_usuario: { "0109": "unregistered", "0808": "unregistered" },
            matriculas_validadas: []
        }
    ],
    loja: [
        {
            id: "item_1",
            nome: "Chaveiro / Bottom Emblema",
            tipo: "global",
            custo: 2,
            estoque: 50,
            icon: "fa-solid fa-key",
            foto: "",
            protegido: true
        },
        {
            id: "item_2",
            nome: "Garrafa Térmica Executiva",
            tipo: "global",
            custo: 5,
            estoque: 15,
            icon: "fa-solid fa-bottle-water",
            foto: "",
            protegido: true
        },
        {
            id: "item_3",
            nome: "Cartão Presente Digital (R$ 50,00)",
            tipo: "global",
            custo: 6,
            estoque: 10,
            icon: "fa-solid fa-gift",
            foto: "",
            protegido: true
        },
        {
            id: "item_4",
            nome: "Produto Customizado da Empresa",
            tipo: "local",
            custo: 12,
            estoque: 5,
            icon: "fa-solid fa-shirt",
            foto: "",
            protegido: false
        },
        {
            id: "item_5",
            nome: "Day Off (1 Dia de Folga Programada)",
            tipo: "local",
            custo: 15,
            estoque: 3,
            icon: "fa-solid fa-calendar-minus",
            foto: "",
            protegido: true
        }
    ],
    extrato_por_usuario: {
        "0109": [
            {
                data: "01/07/2026 08:30",
                tipo: "credito",
                desc: "Saldo inicial ao ser cadastrado",
                valor: 4
            }
        ],
        "0808": [
            {
                data: "01/07/2026 08:30",
                tipo: "credito",
                desc: "Saldo inicial ao ser cadastrado",
                valor: 10
            }
        ]
    }
};

// 2. ESTADO GLOBAL
let db = null;
let currentLoggedUser = null;
let currentActiveTrainingId = null;
let activeEventSource = null;

// Configuração de comunicação com o backend local
const apiBase = (window.location.protocol === 'file:' || window.location.hostname === '')
    ? 'http://localhost:3000'
    : `${window.location.protocol}//${window.location.host}`;
let serverIP = '192.168.0.45';
let serverIPs = [];
let currentSelectedIP = '';

// Sincroniza o banco local com o servidor
async function syncWithServer() {
    try {
        const response = await fetch(`${apiBase}/api/db`);
        if (response.ok) {
            db = await response.json();
            return true;
        }
    } catch (e) {
        console.error("Falha ao sincronizar com o backend:", e);
    }
    return false;
}

// Inicializa a aplicação
async function initApp() {
    // Tenta obter o IP do servidor local
    try {
        const ipResponse = await fetch(`${apiBase}/api/ip`);
        if (ipResponse.ok) {
            const ipData = await ipResponse.json();
            serverIP = ipData.ip;
            serverIPs = ipData.ips || [{ name: 'IP Padrão', address: ipData.ip }];
            currentSelectedIP = serverIP;
            
            // Popula os seletores de rede na interface
            populateNetworkSelectors();
        }
    } catch (e) {
        console.error("Não foi possível obter o IP do servidor local, usando fallback:", e);
        serverIPs = [{ name: 'Fallback Local', address: serverIP }];
        currentSelectedIP = serverIP;
    }

    try {
        const response = await fetch(`${apiBase}/api/db`);
        if (response.ok) {
            db = await response.json();
        } else {
            throw new Error("Servidor retornou " + response.status);
        }
    } catch (e) {
        console.error("Backend não encontrado. Usando fallback via localStorage ou dados iniciais.", e);
        const savedData = localStorage.getItem("chaves_tcc_db_v2");
        if (savedData) {
            db = JSON.parse(savedData);
        } else {
            db = JSON.parse(JSON.stringify(INITIAL_DATABASE_V2));
            saveDataToStorage();
        }
    }
    
    // Auto-migrate if loaded from old localStorage
    let migrated = false;
    let currentCompanyCode = 1;
    const companyCodeMap = {};
    
    db.empresas.forEach(emp => {
        if (!emp.codigo) {
            emp.codigo = currentCompanyCode++;
            migrated = true;
        }
        companyCodeMap[emp.id] = emp.codigo;
    });
    
    const matriculaMap = {};
    if (db.usuarios) {
        db.usuarios.forEach(user => {
            const codigo = companyCodeMap[user.fk_empresa];
            if (codigo && !user.matricula.startsWith(`${codigo}-`)) {
                const oldMat = user.matricula;
                const newMat = `${codigo}-${oldMat}`;
                matriculaMap[oldMat] = newMat;
                user.matricula = newMat;
                user.id_usuario = `usr_${newMat}`;
                migrated = true;
            }
        });
    }
    
    if (migrated) {
        if (db.extrato_por_usuario) {
            const newExtratos = {};
            for (const [oldMat, extrato] of Object.entries(db.extrato_por_usuario)) {
                newExtratos[matriculaMap[oldMat] || oldMat] = extrato;
            }
            db.extrato_por_usuario = newExtratos;
        }
        
        if (db.treinamentos) {
            db.treinamentos.forEach(treinamento => {
                if (treinamento.matriculas_validadas) {
                    treinamento.matriculas_validadas = treinamento.matriculas_validadas.map(oldMat => matriculaMap[oldMat] || oldMat);
                }
                if (treinamento.status_por_usuario) {
                    const newStatus = {};
                    for (const [oldMat, status] of Object.entries(treinamento.status_por_usuario)) {
                        newStatus[matriculaMap[oldMat] || oldMat] = status;
                    }
                    treinamento.status_por_usuario = newStatus;
                }
            });
        }
        try { saveDataToStorage(); } catch(e) {}
        console.log("Migração local de matrículas concluída.");
    }
    
    // Popula formulários e tabelas do Painel Admin
    populateEmpresasDropdown();
    renderAdminTables();
    
    // Verifica se há sessão ativa
    const activeMatricula = sessionStorage.getItem("portal_logged_in_matricula");
    if (activeMatricula) {
        const user = db.usuarios.find(u => u.matricula === activeMatricula);
        if (user) {
            currentLoggedUser = user;
            document.getElementById("loginOverlay").classList.remove("active");
            document.getElementById("portalMainContent").classList.add("active-layout");
            updatePortalDashboard();
            
            // Inicializa chat websocket
            initChatWebSocket();
        } else {
            sessionStorage.removeItem("portal_logged_in_matricula");
        }
    }
    
    updateDemoController();
    renderHeroMockup();

    // Gerar QR Code de acesso móvel na tela de Login Desktop
    regenerateAllQrs();

    // Verifica parâmetros da URL para direcionamento ou ação de presença
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    if (viewParam === 'portal') {
        switchView('portal');
    }
    
    const actionParam = urlParams.get('action');
    const trainingParam = urlParams.get('training');
    const pinParam = urlParams.get('pin');
    
    if (actionParam === 'presence' && trainingParam && pinParam) {
        sessionStorage.setItem("pending_presence_training", trainingParam);
        sessionStorage.setItem("pending_presence_pin", pinParam);
        switchView('portal');
    }
    
    // Se logado e houver validação pendente de presença direta
    const pendingTraining = sessionStorage.getItem("pending_presence_training");
    const pendingPin = sessionStorage.getItem("pending_presence_pin");
    if (currentLoggedUser && pendingTraining && pendingPin) {
        sessionStorage.removeItem("pending_presence_training");
        sessionStorage.removeItem("pending_presence_pin");
        openDirectPresenceValidation(pendingTraining, pendingPin);
    }

    // Loop de sincronização periódica a cada 5 segundos (roda sempre para atualizar cache local)
    setInterval(async () => {
        const oldDbString = JSON.stringify(db);
        const synced = await syncWithServer();
        if (synced && JSON.stringify(db) !== oldDbString) {
            console.log("Banco de dados sincronizado e atualizado em tempo real.");
            if (currentLoggedUser) {
                updatePortalDashboard();
            }
            renderAdminTables();
            renderHeroMockup();
        }
    }, 5000);
}

async function saveDataToStorage() {
    // Continua salvando no localStorage como fallback
    localStorage.setItem("chaves_tcc_db_v2", JSON.stringify(db));
    
    // Envia para o servidor backend para salvar no db.json
    try {
        await fetch(`${apiBase}/api/db`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(db)
        });
    } catch (e) {
        console.error("Aviso: Falha ao sincronizar com o backend Node.", e);
    }
}

// Atualiza o mockup flutuante da Landing Page com o primeiro usuário cadastrado
function renderHeroMockup() {
    const firstUser = db.usuarios[0];
    if (firstUser) {
        const company = db.empresas.find(e => e.id === firstUser.fk_empresa);
        document.getElementById("mockupProfileName").textContent = firstUser.nome_completo;
        document.getElementById("mockupProfileDept").textContent = `${firstUser.setor} | ${company ? company.nome_fantasia : ''}`;
        document.getElementById("mockupProfileStars").textContent = `⭐ ${firstUser.saldo_estrelas} Estrelas`;
    }
}

// ==========================================================================
// PAINEL DE DEMONSTRAÇÃO E NAVEGAÇÃO DA LANDING PAGE
// ==========================================================================

function switchView(viewName) {
    const landingView = document.getElementById("landingView");
    const portalView = document.getElementById("portalView");
    const btnShowLanding = document.getElementById("btnShowLanding");
    const btnShowPortal = document.getElementById("btnShowPortal");
    
    document.getElementById("mainNav").classList.remove("active");
    document.getElementById("menuBtnIcon").className = "fa-solid fa-bars";

    if (viewName === 'landing') {
        landingView.classList.add("active");
        portalView.classList.remove("active");
        btnShowLanding.classList.add("active");
        btnShowPortal.classList.remove("active");
        
        // Atualiza tabelas administrativas
        renderAdminTables();
        populateEmpresasDropdown();
    } else {
        landingView.classList.remove("active");
        portalView.classList.add("active");
        btnShowLanding.classList.remove("active");
        btnShowPortal.classList.add("active");
        
        if (currentLoggedUser) {
            updatePortalDashboard();
        }
    }
    updateDemoController();
}

// Demo controller removido — funções mantidas como no-op para compatibilidade
function toggleDemoController() { /* demo panel removido */ }
function updateDemoController() { /* demo panel removido */ }


function toggleMobileMenu() {
    const nav = document.getElementById("mainNav");
    const icon = document.getElementById("menuBtnIcon");
    nav.classList.toggle("active");
    icon.className = nav.classList.contains("active") ? "fa-solid fa-xmark" : "fa-solid fa-bars";
}

function toggleMobileSidebar() {
    document.querySelector(".portal-sidebar").classList.toggle("active");
}

function handleContactSubmit(event) {
    event.preventDefault();
    alert("Mensagem enviada com sucesso! Nossa equipe entrará em contato em breve.");
    event.target.reset();
}

// ==========================================================================
// PAINEL ADMIN: CADASTROS REAIS
// ==========================================================================

// Popula o dropdown de empresas no cadastro de personagens
function populateEmpresasDropdown() {
    const select = document.getElementById("col_empresa");
    if (!select) return;
    select.innerHTML = "";
    db.empresas.forEach(emp => {
        const option = document.createElement("option");
        option.value = emp.id;
        option.textContent = emp.nome_fantasia;
        select.appendChild(option);
    });
}

// Renderiza a listagem de registros cadastrados
function renderAdminTables() {
    const body = document.getElementById("adminUsersListBody");
    if (!body) return;
    body.innerHTML = "";
    
    db.usuarios.forEach(user => {
        const row = document.createElement("tr");
        const company = db.empresas.find(e => e.id === user.fk_empresa);
        const companyName = company ? company.nome_fantasia : "N/A";
        
        row.innerHTML = `
            <td style="font-weight: 700; color: var(--color-primary);">${user.nome_completo}</td>
            <td><code>${user.matricula}</code></td>
            <td>${user.cargo} (${user.setor})</td>
            <td>${companyName}</td>
            <td style="font-weight: bold; color: var(--color-warning);">⭐ ${user.saldo_estrelas}</td>
            <td>
                <button class="btn-copy-login" onclick="quickLogin('${user.matricula}')">
                    <i class="fa-solid fa-right-to-bracket"></i> Logar
                </button>
            </td>
        `;
        body.appendChild(row);
    });
}

// Ação de Cadastrar Nova Empresa
async function handleRegisterEmpresa(event) {
    event.preventDefault();
    const nome = document.getElementById("emp_nome").value.trim();
    const razao = document.getElementById("emp_razao").value.trim();
    const cnpj = document.getElementById("emp_cnpj").value.trim();
    const status = document.getElementById("emp_status").value;
    
    await syncWithServer();
    
    const id = "emp_" + nome.toLowerCase().replace(/[^a-z0-9]/g, "_");
    
    // Evita duplicados
    if (db.empresas.some(e => e.id === id || e.cnpj === cnpj)) {
        alert("Esta empresa ou CNPJ já está cadastrada no simulador.");
        return;
    }
    
    // Auto-incremento do código da empresa para o PIN
    let maxCodigo = 0;
    db.empresas.forEach(emp => {
        if (emp.codigo && emp.codigo > maxCodigo) {
            maxCodigo = emp.codigo;
        }
    });
    const novoCodigo = maxCodigo + 1;
    
    db.empresas.push({ id, nome_fantasia: nome, razao_social: razao, cnpj, status_contrato: status, codigo: novoCodigo });
    await saveDataToStorage();
    populateEmpresasDropdown();
    event.target.reset();
    alert("Empresa cadastrada com sucesso! Agora você pode vinculá-la a colaboradores.");
}

// Ação de Cadastrar Novo Colaborador (Personagem)
async function handleRegisterColaborador(event) {
    event.preventDefault();
    const nome = document.getElementById("col_nome").value.trim();
    const matriculaBase = document.getElementById("col_matricula").value.trim();
    const estrelas = parseInt(document.getElementById("col_estrelas").value) || 0;
    const cargo = document.getElementById("col_cargo").value.trim();
    const empresaId = document.getElementById("col_empresa").value;
    
    await syncWithServer();
    
    // Obtem o codigo da empresa para formatar a matricula
    const empresaInfo = db.empresas.find(e => e.id === empresaId);
    let codigo = 0;
    if (empresaInfo && empresaInfo.codigo) {
        codigo = empresaInfo.codigo;
    }
    const matriculaFormatada = `${codigo}-${matriculaBase}`;
    
    // Valida unicidade de matrícula
    if (db.usuarios.some(u => u.matricula === matriculaFormatada)) {
        alert("Esta matrícula já está sendo usada por outro colaborador.");
        return;
    }
    
    const id_usuario = "usr_" + matriculaFormatada;
    
    // Cria usuário
    db.usuarios.push({
        id_usuario,
        fk_empresa: empresaId,
        nome_completo: nome,
        matricula: matriculaFormatada,
        cargo,
        setor: "Geral",
        saldo_estrelas: estrelas,
        status: "Ativo",
        senha: "123456",
        role: "colaborador",
        foto: ""
    });
    
    // Inicializa extrato para o novo usuário
    if (!db.extrato_por_usuario) db.extrato_por_usuario = {};
    db.extrato_por_usuario[matriculaFormatada] = [
        {
            data: getCurrentFormattedDateTime(),
            tipo: "credito",
            desc: "Saldo inicial no cadastro dinâmico",
            valor: estrelas
        }
    ];
    
    await saveDataToStorage();
    renderAdminTables();
    renderHeroMockup();
    event.target.reset();
    alert(`Personagem ${nome} cadastrado! Use a matrícula ${matriculaFormatada} para logar no portal.`);
}

// Login rápido via tabela admin
function quickLogin(matricula) {
    sessionStorage.setItem("portal_logged_in_matricula", matricula);
    const user = db.usuarios.find(u => u.matricula === matricula);
    if (user) {
        currentLoggedUser = user;
        document.getElementById("loginOverlay").classList.remove("active");
        document.getElementById("portalMainContent").classList.add("active-layout");
        switchView('portal');
    }
}

// Helper: Data e hora formatados
function getCurrentFormattedDateTime() {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}


// ==========================================================================
// PORTAL DO COLABORADOR: AUTENTICAÇÃO
// ==========================================================================

function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector("i");
    if (input.type === "password") {
        input.type = "text";
        icon.className = "fa-solid fa-eye-slash";
    } else {
        input.type = "password";
        icon.className = "fa-solid fa-eye";
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const matriculaInput = document.getElementById("l_matricula").value.trim();
    const senha = document.getElementById("l_senha").value;
    
    // Sincroniza usuários do servidor antes de validar login
    await syncWithServer();
    
    let companyCode = "";
    let pin = "";
    if (matriculaInput.includes("-")) {
        const parts = matriculaInput.split("-");
        companyCode = parts[0].trim();
        pin = parts.slice(1).join("-").trim();
    } else {
        pin = matriculaInput;
    }
    
    let user = null;
    if (companyCode) {
        const company = db.empresas.find(e => String(e.codigo) === companyCode);
        if (company) {
            user = db.usuarios.find(u => u.fk_empresa === company.id && (u.matricula === matriculaInput || u.matricula === `${companyCode}-${pin}`));
        }
    }
    
    if (!user) {
        user = db.usuarios.find(u => u.matricula === matriculaInput);
    }
    
    if (!user && !companyCode) {
        // Fallback para login demonstrativo sem prefixo
        user = db.usuarios.find(u => u.matricula.endsWith(`-${pin}`) || u.matricula === pin);
    }
    
    if (user) {
        const userSenha = user.senha || "123456";
        if (userSenha === senha) {
            currentLoggedUser = user;
            sessionStorage.setItem("portal_logged_in_matricula", user.matricula);
            document.getElementById("loginOverlay").classList.remove("active");
            document.getElementById("portalMainContent").classList.add("active-layout");
            
            // Inicializa chat websocket
            initChatWebSocket();
            
            // Se houver validação pendente
            const pendingTraining = sessionStorage.getItem("pending_presence_training");
            const pendingPin = sessionStorage.getItem("pending_presence_pin");
            if (pendingTraining && pendingPin) {
                sessionStorage.removeItem("pending_presence_training");
                sessionStorage.removeItem("pending_presence_pin");
                openDirectPresenceValidation(pendingTraining, pendingPin);
            }
            
            updatePortalDashboard();
            updateDemoController();
            renderHeroMockup();
        } else {
            alert("Senha incorreta corporativa.");
        }
    } else {
        alert("Matrícula/PIN inválido! Verifique se o colaborador está cadastrado.");
    }
}

function handleLogout() {
    sessionStorage.removeItem("portal_logged_in_matricula");
    currentLoggedUser = null;
    document.getElementById("loginOverlay").classList.add("active");
    document.getElementById("portalMainContent").classList.remove("active-layout");
    document.querySelector(".portal-sidebar").classList.remove("active");
    updateDemoController();
}


// ==========================================================================
// PORTAL DO COLABORADOR: WORKSPACE E NAVEGAÇÃO INTERNA
// ==========================================================================

function switchPortalTab(tabName) {
    document.querySelectorAll(".portal-tab-content").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".sidebar-nav-btn").forEach(btn => btn.classList.remove("active"));
    
    const tabEl = document.getElementById(`tab_${tabName}`);
    const btnEl = document.getElementById(`tabBtn_${tabName}`);
    
    if (tabEl) tabEl.classList.add("active");
    if (btnEl) btnEl.classList.add("active");
    
    document.querySelector(".portal-sidebar").classList.remove("active");

    const title = document.getElementById("currentTabTitle");
    const subtitle = document.getElementById("currentTabSubtitle");
    
    switch(tabName) {
        case 'comunicados':
            title.textContent = "Quadro de Avisos";
            subtitle.textContent = "Mural oficial de comunicação interna da empresa";
            renderComunicados('todos');
            break;
        case 'treinamentos':
            title.textContent = "Treinamentos & Presença";
            subtitle.textContent = "Valide seus treinamentos pendentes para acumular estrelas";
            renderTreinamentos();
            break;
        case 'loja':
            title.textContent = "Loja de Recompensas";
            subtitle.textContent = "Troque suas estrelas por prêmios e dias de folga";
            renderStore('todos');
            break;
        case 'extrato':
            title.textContent = "Extrato & Perfil";
            subtitle.textContent = "Veja seu saldo de estrelas, dados cadastrais e histórico de transações";
            renderExtrato();
            break;
        case 'gestao':
            title.textContent = "Painel de Gestão Corporativa";
            subtitle.textContent = "Gerencie colaboradores e catálogo de prêmios da sua empresa";
            renderGestorPanel();
            break;
        case 'chat':
            title.textContent = "Chat da Empresa";
            subtitle.textContent = "Comunicação corporativa segura e moderada em tempo real";
            
            // Marca a aba atual como lida
            chatUnreadCounts[chatActiveTarget] = 0;
            updateChatUnreadBadgeCount();
            
            renderChatSidebar();
            updateChatHeader();
            renderChatMessages();
            break;
    }
}

function updatePortalDashboard() {
    if (!currentLoggedUser) return;
    
    const company = db.empresas.find(e => e.id === currentLoggedUser.fk_empresa);
    
    // Atualiza cabeçalhos
    document.getElementById("clientCompanyTitle").textContent = company ? company.nome_fantasia : "Chaves Clima";
    document.getElementById("userNameDisplay").textContent = currentLoggedUser.nome_completo;
    document.getElementById("userRoleDisplay").textContent = `${currentLoggedUser.cargo} (${currentLoggedUser.role === 'gestor' ? 'Gestor' : 'Colaborador'})`;
    document.getElementById("userMatriculaDisplay").textContent = currentLoggedUser.matricula;
    
    // Atualiza controle de acesso ao menu de gestão
    const btnGestao = document.getElementById("tabBtn_gestao");
    if (currentLoggedUser.role === 'gestor') {
        btnGestao.style.display = "block";
    } else {
        btnGestao.style.display = "none";
    }

    // Atualiza Foto de Perfil na Sidebar
    const sideDefault = document.getElementById("sidebarDefaultAvatar");
    const sideCustom = document.getElementById("sidebarCustomAvatar");
    if (currentLoggedUser.foto) {
        sideDefault.style.display = "none";
        sideCustom.src = currentLoggedUser.foto;
        sideCustom.style.display = "block";
    } else {
        sideDefault.style.display = "block";
        sideCustom.style.display = "none";
    }
    
    // Atualiza contadores
    document.querySelectorAll(".stars-val, #storeStarsBalance").forEach(counter => {
        counter.textContent = currentLoggedUser.saldo_estrelas;
    });
    
    // Força renderização da aba ativa
    const activeBtn = document.querySelector(".sidebar-nav-btn.active");
    const activeTab = activeBtn ? activeBtn.id.replace("tabBtn_", "") : "comunicados";
    
    // Se era uma aba de gestor e o usuário atual não for gestor, redireciona
    if (activeTab === 'gestao' && currentLoggedUser.role !== 'gestor') {
        switchPortalTab('comunicados');
    } else {
        switchPortalTab(activeTab);
    }
}

// RENDER: QUADRO DE AVISOS
function renderComunicados(filterType) {
    const container = document.getElementById("comunicadosContainer");
    container.innerHTML = "";
    
    const filtered = db.comunicados.filter(item => {
        if (filterType === 'todos') return true;
        return item.tipo === filterType;
    });
    
    filtered.forEach(item => {
        const card = document.createElement("div");
        card.className = "comunicado-card";
        const badgeClass = item.tipo === 'treinamento' ? 'treinamento' : 'operacional';
        const badgeLabel = item.tipo === 'treinamento' ? 'SST & Clima' : 'Operacional';
        
        let starBadge = "";
        let footerAction = "";
        if (item.tipo === 'treinamento' && item.pontos > 0) {
            starBadge = `<div class="comunicado-points-badge"><i class="fa-solid fa-star"></i> +${item.pontos} Estrela</div>`;
            footerAction = `
                <div class="comunicado-card-footer">
                    <button class="comunicado-action-btn" onclick="switchPortalTab('treinamentos')">
                        Confirmar Presença <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            `;
        }
        
        card.innerHTML = `
            ${starBadge}
            <div class="comunicado-meta">
                <span class="comunicado-type-badge ${badgeClass}">${badgeLabel}</span>
                <span class="comunicado-date"><i class="fa-solid fa-calendar-day"></i> ${item.data}</span>
            </div>
            <h3>${item.titulo}</h3>
            <p>${item.conteudo}</p>
            ${footerAction}
        `;
        container.appendChild(card);
    });
}

function filterAvisos(type) {
    document.querySelectorAll("#tab_comunicados .filter-chip").forEach(c => c.classList.remove("active"));
    document.getElementById(`btnFilterAviso_${type}`).classList.add("active");
    renderComunicados(type);
}

// RENDER: AGENDA DE TREINAMENTOS (SUMIR CONCLUÍDOS)
function renderTreinamentos() {
    const container = document.getElementById("treinamentosContainer");
    container.innerHTML = "";
    const mat = currentLoggedUser.matricula;
    
    // Mostra treinamentos onde o usuário NÃO validou a presença E (pertencem à empresa dele OU ele está explicitamente mapeado)
    // E o treinamento NÃO foi encerrado pelo gestor
    const pendentes = db.treinamentos.filter(t => {
        const belongsToCompany = t.fk_empresa === currentLoggedUser.fk_empresa;
        const isMapped = t.status_por_usuario && t.status_por_usuario.hasOwnProperty(mat);
        const notValidated = !t.matriculas_validadas.includes(mat);
        const notEncerrado = !t.encerrado;
        return (belongsToCompany || isMapped) && notValidated && notEncerrado;
    });
    
    if (pendentes.length === 0) {
        container.innerHTML = `
            <div class="workspace-card-info" style="border-color: rgba(16, 185, 129, 0.3); background-color: var(--color-success-bg);">
                <div class="info-desc" style="color: var(--color-success);">
                    <h3><i class="fa-solid fa-circle-check"></i> Tudo em dia!</h3>
                    <p>Você participou e validou todos os treinamentos agendados até o momento. Excelente trabalho!</p>
                </div>
            </div>
        `;
        return;
    }
    
    pendentes.forEach(item => {
        const card = document.createElement("div");
        card.className = "treinamento-row-card";
        
        if (!item.status_por_usuario) item.status_por_usuario = {};
        const status = item.status_por_usuario[mat] || "unregistered";
        const isRegistered = status === 'registered';
        
        const regBtnClass = isRegistered ? 'registered' : 'unregistered';
        const regBtnLabel = isRegistered ? '<i class="fa-solid fa-check"></i> Intenção Confirmada' : 'Confirmar Presença';
        
        const validateBtn = isRegistered 
            ? `<button class="btn btn-validate-presence" onclick="openEmployeeScannerModal('${item.id}')"><i class="fa-solid fa-qrcode"></i> Validar Presença</button>`
            : "";
            
        card.innerHTML = `
            <div class="treinamento-row-info">
                <h4>${item.titulo}</h4>
                <div class="treinamento-row-meta">
                    <span><i class="fa-solid fa-calendar-days"></i> ${item.data}</span>
                    <span class="meta-star"><i class="fa-solid fa-star"></i> Pontua 1 Estrela</span>
                </div>
            </div>
            <div class="treinamento-row-actions">
                <button class="btn btn-presence-state ${regBtnClass}" onclick="togglePresenceIntention('${item.id}')">
                    ${regBtnLabel}
                </button>
                ${validateBtn}
            </div>
        `;
        container.appendChild(card);
    });
}

async function togglePresenceIntention(id) {
    if (!currentLoggedUser) return;
    await syncWithServer();
    const tr = db.treinamentos.find(item => item.id === id);
    if (tr) {
        const mat = currentLoggedUser.matricula;
        const currentStatus = tr.status_por_usuario[mat] || "unregistered";
        tr.status_por_usuario[mat] = currentStatus === 'registered' ? 'unregistered' : 'registered';
        await saveDataToStorage();
        renderTreinamentos();
    }
}

// RENDER: LOJA DE RECOMPENSAS (REMOVIDA ORIGEM)
function renderStore(filterType) {
    const container = document.getElementById("storeContainer");
    container.innerHTML = "";
    
    const filtered = db.loja.filter(item => {
        if (filterType === 'todos') return true;
        return item.tipo === filterType;
    });
    
    filtered.forEach(item => {
        const card = document.createElement("div");
        card.className = `store-item-card ${item.tipo}`;
        
        const badgeLabel = item.tipo === 'global' ? 'Global' : 'Local';
        const badgeClass = item.tipo === 'global' ? 'cyan' : 'purple';
        
        const isAffordable = currentLoggedUser.saldo_estrelas >= item.custo;
        const outOfStock = item.estoque <= 0;
        
        let btnAction = "";
        if (outOfStock) {
            btnAction = `<button class="btn btn-secondary btn-redeem insufficient" disabled>Sem Estoque</button>`;
        } else if (!isAffordable) {
            btnAction = `<button class="btn btn-secondary btn-redeem insufficient" disabled>Saldo Insuficiente</button>`;
        } else {
            btnAction = `<button class="btn btn-primary btn-redeem" onclick="redeemStoreItem('${item.id}')">Resgatar</button>`;
        }
        
        const mediaElement = item.foto 
            ? `<div class="store-item-photo" style="width: 100%; height: 120px; border-radius: var(--border-radius-sm); overflow: hidden; margin-bottom: 12px; border: 1px solid var(--color-border); display: flex; align-items: center; justify-content: center;"><img src="${item.foto}" style="width: 100%; height: 100%; object-fit: cover;"></div>`
            : `<div class="store-item-icon"><i class="${item.icon || 'fa-solid fa-gift'}"></i></div>`;
            
        card.innerHTML = `
            <span class="card-badge ${badgeClass}">${badgeLabel}</span>
            ${mediaElement}
            <h4>${item.nome}</h4>
            <div class="store-item-footer">
                <div class="store-item-price">
                    <span class="price-lbl">Custo</span>
                    <span class="price-val"><i class="fa-solid fa-star"></i> ${item.custo}</span>
                </div>
                ${btnAction}
            </div>
        `;
        container.appendChild(card);
    });
}

function filterStore(type) {
    document.querySelectorAll("#tab_loja .filter-chip").forEach(c => c.classList.remove("active"));
    document.getElementById(`btnFilterStore_${type}`).classList.add("active");
    renderStore(type);
}

// RENDER: EXTRATO E DADOS CADASTRAIS
function renderExtrato() {
    if (!currentLoggedUser) return;
    
    const mat = currentLoggedUser.matricula;
    const company = db.empresas.find(e => e.id === currentLoggedUser.fk_empresa);
    
    // Perfil
    document.getElementById("profileName").textContent = currentLoggedUser.nome_completo;
    document.getElementById("profileMatricula").textContent = currentLoggedUser.matricula;
    document.getElementById("profileRole").textContent = currentLoggedUser.cargo;
    document.getElementById("profileCompany").textContent = company ? company.nome_fantasia : "N/A";
    
    // Foto de Perfil Grande
    const largeDefault = document.getElementById("profileLargeDefaultAvatar");
    const largeCustom = document.getElementById("profileLargeCustomAvatar");
    if (currentLoggedUser.foto) {
        largeDefault.style.display = "none";
        largeCustom.src = currentLoggedUser.foto;
        largeCustom.style.display = "block";
    } else {
        largeDefault.style.display = "block";
        largeCustom.style.display = "none";
    }
    
    // Histórico
    const tableBody = document.getElementById("extratoTableBody");
    tableBody.innerHTML = "";
    
    const trans = db.extrato_por_usuario[mat] || [];
    const sorted = [...trans].reverse();
    
    if (sorted.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-light);">Nenhuma movimentação.</td></tr>`;
        return;
    }
    
    sorted.forEach(item => {
        const row = document.createElement("tr");
        const badgeClass = item.tipo === 'credito' ? 'credit' : 'debit';
        const prefix = item.tipo === 'credito' ? '+' : '-';
        const valText = `${prefix}${item.valor} ${item.valor === 1 ? 'Estrela' : 'Estrelas'}`;
        
        row.innerHTML = `
            <td>${item.data}</td>
            <td><span class="extrato-val-badge ${badgeClass}">${item.tipo === 'credito' ? 'Crédito' : 'Débito'}</span></td>
            <td>${item.desc}</td>
            <td style="font-weight: bold; color: ${item.tipo === 'credito' ? 'var(--color-success)' : 'var(--color-danger)'}">${valText}</td>
        `;
        tableBody.appendChild(row);
    });
}


// ==========================================================================
// INTEGRAÇÃO QR CODE COM CELULAR FÍSICO (PUB/SUB NTFY.SH)
// ==========================================================================

function openValidatorModal(trainingId) {
    currentActiveTrainingId = trainingId;
    const tr = db.treinamentos.find(item => item.id === trainingId);
    
    if (tr) {
        document.getElementById("modalTrainingTitle").textContent = tr.titulo;
        document.getElementById("validatorModal").classList.add("active");
        
        resetPinInputs();
        document.getElementById("pinErrorMsg").style.display = "none";
        
        // Configura QR Code Real via ntfy.sh
        setupRealQrCode(tr);
        switchValidatorMethod('pin');
    }
}

function closeValidatorModal() {
    document.getElementById("validatorModal").classList.remove("active");
    currentActiveTrainingId = null;
    
    // Fecha conexão SSE ativa para evitar redundâncias
    if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
    }
}

function switchValidatorMethod(method) {
    const tabPin = document.getElementById("vTabPin");
    const tabQr = document.getElementById("vTabQr");
    const methodPin = document.getElementById("vMethodPinContainer");
    const methodQr = document.getElementById("vMethodQrContainer");
    
    if (method === 'pin') {
        tabPin.classList.add("active");
        tabQr.classList.remove("active");
        methodPin.classList.add("active");
        methodQr.classList.remove("active");
        document.getElementById("pinDigit1").focus();
    } else {
        tabPin.classList.remove("active");
        tabQr.classList.add("active");
        methodPin.classList.remove("active");
        methodQr.classList.add("active");
    }
}

function movePinFocus(input, index) {
    if (input.value.length === 1 && index < 4) {
        document.getElementById(`pinDigit${index + 1}`).focus();
    }
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && input.value.length === 0 && index > 1) {
            document.getElementById(`pinDigit${index - 1}`).focus();
        }
    });
}

function resetPinInputs() {
    for (let i = 1; i <= 4; i++) {
        document.getElementById(`pinDigit${i}`).value = "";
    }
}

async function submitPinValidation() {
    const trainingId = currentActiveTrainingId;
    const entered = `${document.getElementById("pinDigit1").value}${document.getElementById("pinDigit2").value}${document.getElementById("pinDigit3").value}${document.getElementById("pinDigit4").value}`;
    
    await syncWithServer();
    
    const tr = db.treinamentos.find(item => item.id === trainingId);
    
    // Valida contra o PIN dinâmico TOTP (mesmo sistema que o gestor exibe)
    if (tr && isValidDynamicPIN(tr.id, entered)) {
        currentActiveTrainingId = trainingId;
        executeValidationSuccess(tr, 'pin');
    } else {
        document.getElementById("pinErrorMsg").style.display = "block";
        const wrapper = document.querySelector(".pin-inputs-wrapper");
        wrapper.style.animation = "shakeError 0.4s ease";
        setTimeout(() => { wrapper.style.animation = ""; }, 400);
        resetPinInputs();
        document.getElementById("pinDigit1").focus();
    }
}

// Configuração do ntfy.sh para escuta do celular físico
function setupRealQrCode(training) {
    if (activeEventSource) {
        activeEventSource.close();
    }
    
    const mat = currentLoggedUser.matricula;
    // Cria canal exclusivo baseado no usuário e evento
    const topicId = `chaves_tcc_qr_${mat}_${training.id}`;
    
    // URL que o celular irá carregar
    const callbackUrl = `https://ntfy.sh/${topicId}/publish?message=validated`;
    
    // Gera a imagem do QR Code usando API pública e confiável
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(callbackUrl)}`;
    document.getElementById("qrCodeImage").src = qrApiUrl;
    
    // Abre a conexão em tempo real (SSE - Server-Sent Events) no laptop
    activeEventSource = new EventSource(`https://ntfy.sh/${topicId}/sse`);
    
    activeEventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.message === "validated") {
                // Presença recebida em tempo real do celular!
                if (activeEventSource) {
                    activeEventSource.close();
                    activeEventSource = null;
                }
                executeValidationSuccess(training, 'qr');
            }
        } catch (err) {
            console.error("Erro no processamento SSE:", err);
        }
    };
}

// Credita estrela por validação
async function executeValidationSuccess(training, source) {
    const mat = currentLoggedUser.matricula;
    
    // Atualiza o banco com o servidor antes de alterar
    await syncWithServer();
    
    // Reobtem referências atualizadas
    const freshTraining = db.treinamentos.find(t => t.id === training.id);
    const freshUser = db.usuarios.find(u => u.matricula === mat);
    
    if (freshTraining && freshUser) {
        if (!freshTraining.matriculas_validadas.includes(mat)) {
            freshTraining.matriculas_validadas.push(mat);
        }
        
        freshUser.saldo_estrelas += 1;
        currentLoggedUser = freshUser;
        
        // Registra presença na sessão (para o relatório do gestor)
        if (!freshTraining.presencas_sessao) freshTraining.presencas_sessao = [];
        const jaRegistrado = freshTraining.presencas_sessao.some(p => p.matricula === mat);
        if (!jaRegistrado) {
            const agora = new Date();
            const horaEntrada = `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}:${String(agora.getSeconds()).padStart(2,'0')}`;
            freshTraining.presencas_sessao.push({
                matricula: mat,
                nome: freshUser.nome_completo,
                setor: freshUser.setor || freshUser.cargo || 'N/A',
                hora_entrada: horaEntrada,
                hora_entrada_ts: Date.now()
            });
        }
        
        // Lança no extrato
        const dateTime = getCurrentFormattedDateTime();
        if (!db.extrato_por_usuario[mat]) db.extrato_por_usuario[mat] = [];
        db.extrato_por_usuario[mat].push({
            data: dateTime,
            tipo: "credito",
            desc: `Presença Validada no evento: ${freshTraining.titulo}`,
            valor: 1
        });
        
        await saveDataToStorage();
        updatePortalDashboard();
    }
    
    closeValidatorModal();
    
    // Mostra imagem especial ao ler o QR Code; ícone padrão para PIN
    const qrImageWrapper = document.getElementById("successQrImageWrapper");
    const iconWrapper = document.getElementById("successIconWrapper");
    if (source === 'qr') {
        if (qrImageWrapper) qrImageWrapper.style.display = "flex";
        if (iconWrapper) iconWrapper.style.display = "none";
    } else {
        if (qrImageWrapper) qrImageWrapper.style.display = "none";
        if (iconWrapper) iconWrapper.style.display = "flex";
    }

    // Abre modal de sucesso
    document.getElementById("successModalTitle").textContent = "Presença Confirmada!";
    document.getElementById("successModalText").textContent = `Você validou sua participação no treinamento "${training.titulo}" via celular/PIN e ganhou +1 Estrela!`;
    document.getElementById("successModal").classList.add("active");
}

function closeSuccessModal() {
    document.getElementById("successModal").classList.remove("active");
    // Reseta para estado padrão (ícone) para próximo uso
    const qrImageWrapper = document.getElementById("successQrImageWrapper");
    const iconWrapper = document.getElementById("successIconWrapper");
    if (qrImageWrapper) qrImageWrapper.style.display = "none";
    if (iconWrapper) iconWrapper.style.display = "flex";
    updatePortalDashboard();
    renderHeroMockup();
}


// ==========================================================================
// LOJA DE RECOMPENSAS: RESGATE DE ITENS
// ==========================================================================

async function redeemStoreItem(itemId) {
    if (!currentLoggedUser) return;
    
    // Sincroniza primeiro
    await syncWithServer();
    
    const item = db.loja.find(i => i.id === itemId);
    const mat = currentLoggedUser.matricula;
    const freshUser = db.usuarios.find(u => u.matricula === mat);
    
    if (!item || !freshUser) return;
    
    if (freshUser.saldo_estrelas < item.custo) {
        alert("Você não possui estrelas suficientes.");
        return;
    }
    
    // Atualiza saldos
    freshUser.saldo_estrelas -= item.custo;
    currentLoggedUser = freshUser;
    item.estoque -= 1;
    
    const dateTime = getCurrentFormattedDateTime();
    if (!db.extrato_por_usuario[mat]) db.extrato_por_usuario[mat] = [];
    db.extrato_por_usuario[mat].push({
        data: dateTime,
        tipo: "debito",
        desc: `Resgatado na Loja: ${item.nome}`,
        valor: item.custo
    });
    
    await saveDataToStorage();
    
    // Gera voucher único
    const voucher = `CHV-${item.tipo.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const company = db.empresas.find(e => e.id === currentLoggedUser.fk_empresa);
    
    // Exibe ticket do voucher
    document.getElementById("ticketCompany").textContent = company ? company.nome_fantasia : "Empresa Cliente";
    document.getElementById("ticketUserName").textContent = currentLoggedUser.nome_completo;
    document.getElementById("ticketRewardName").textContent = item.nome;
    document.getElementById("ticketVoucherCode").textContent = voucher;
    document.getElementById("ticketDate").textContent = dateTime;
    
    document.getElementById("voucherModal").classList.add("active");
}

function closeVoucherModal() {
    document.getElementById("voucherModal").classList.remove("active");
    updatePortalDashboard();
    updateDemoController();
    renderHeroMockup();
}

function printVoucher() {
    window.print();
}


// ==========================================================================
// FUNÇÕES DE FOTO DE PERFIL E UPLOAD
// ==========================================================================

function uploadProfilePicture(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 1024 * 1024) {
        alert("A imagem não pode ser maior que 1MB.");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Data = e.target.result;
        currentLoggedUser.foto = base64Data;
        
        // Atualiza no banco de dados local
        const userInDb = db.usuarios.find(u => u.matricula === currentLoggedUser.matricula);
        if (userInDb) {
            userInDb.foto = base64Data;
        }
        
        saveDataToStorage();
        updatePortalDashboard();
        alert("Foto de perfil atualizada com sucesso!");
    };
    reader.readAsDataURL(file);
}

function convertItemPhotoToBase64(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (file.size > 1024 * 1024) {
        alert("A imagem do produto não pode ser maior que 1MB.");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById("g_loja_foto_base64").value = e.target.result;
        alert("Upload da imagem concluído! O arquivo foi carregado com sucesso.");
    };
    reader.readAsDataURL(file);
}


// ==========================================================================
// PAINEL DO GESTOR: COLABORADORES E LOJA
// ==========================================================================
function renderGestorPanel() {
    if (!currentLoggedUser || currentLoggedUser.role !== 'gestor') return;
    
    // Recarrega alertas e chat feed para moderação
    loadGestorModerationAlerts();
    renderGestorChatFeed();
    
    const orgId = currentLoggedUser.fk_empresa;
    const company = db.empresas.find(e => e.id === orgId);
    
    // 0. Preenche o card de informações da empresa
    if (company) {
        document.getElementById("gi_nome").textContent = company.nome_fantasia || "—";
        document.getElementById("gi_razao").textContent = company.razao_social || "—";
        document.getElementById("gi_cnpj").textContent = company.cnpj || "—";
        document.getElementById("gi_codigo").textContent = company.codigo ? `${company.codigo}-` : "—";
        document.getElementById("gi_status").textContent = company.status_contrato || "—";

        // Garante que o seletor exiba a rede correta
        const gestorSelect = document.getElementById('gestorNetworkSelect');
        if (gestorSelect) {
            gestorSelect.value = currentSelectedIP;
        }
        
        // Gera o QR Code de auto-cadastro usando a função global
        regenerateAllQrs();

        // Prefixo travado da matrícula no painel de cadastro do gestor
        const managerPrefixEl = document.getElementById("gestorColabMatriculaPrefix");
        if (managerPrefixEl) {
            managerPrefixEl.textContent = company.codigo ? `${company.codigo}-` : "—";
        }
    }
    
    // Renderiza listagem de treinamentos para controle de presença do gestor (apenas da sua empresa)
    const trainingsList = document.getElementById("gestorTrainingsList");
    if (trainingsList) {
        trainingsList.innerHTML = "";
        const companyTrainings = db.treinamentos.filter(tr => 
            tr.fk_empresa === orgId || 
            (tr.status_por_usuario && Object.keys(tr.status_por_usuario).some(m => m.startsWith(`${company.codigo}-`)))
        );
        companyTrainings.forEach(tr => {
            const row = document.createElement("tr");
            const isEncerrado = tr.encerrado === true;
            const statusBadge = isEncerrado
                ? `<span style="display:inline-flex;align-items:center;gap:4px;background:#fef2f2;color:#dc2626;border:1px solid rgba(220,38,38,0.2);border-radius:20px;padding:3px 10px;font-size:0.72rem;font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> Encerrado</span>`
                : `<span style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;color:#059669;border:1px solid rgba(5,150,105,0.2);border-radius:20px;padding:3px 10px;font-size:0.72rem;font-weight:700;"><i class="fa-solid fa-circle-play"></i> Agendado</span>`;
            
            const btnIniciar = isEncerrado
                ? `<button class="btn btn-secondary btn-sm" onclick="verRelatorioEncerrado('${tr.id}')" style="padding:5px 10px;font-size:0.78rem;"><i class="fa-solid fa-file-chart-column"></i> Ver Relatório</button>`
                : `<button class="btn btn-primary btn-sm" onclick="openGestorPresenceSession('${tr.id}')" style="padding:5px 10px;font-size:0.78rem;"><i class="fa-solid fa-qrcode"></i> Iniciar Presença</button>`;
            
            row.innerHTML = `
                <td style="font-weight:bold;">${tr.titulo}</td>
                <td style="font-size:0.85rem;">${tr.data}</td>
                <td style="text-align:center;">${statusBadge}</td>
                <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${btnIniciar}
                        <button class="btn btn-secondary btn-sm" onclick="openEditTrainingModal('${tr.id}')" style="padding:5px 10px;font-size:0.78rem;" ${isEncerrado ? 'disabled title="Não é possível editar treinamento encerrado"' : ''}><i class="fa-solid fa-pen"></i> Editar</button>
                        <button class="btn btn-secondary btn-sm" onclick="deleteGestorTreinamento('${tr.id}')" style="padding:5px 10px;font-size:0.78rem;color:var(--color-danger);border-color:rgba(220,38,38,0.2);"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            `;
            trainingsList.appendChild(row);
        });
        
        if (companyTrainings.length === 0) {
            trainingsList.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum treinamento agendado ainda.</td></tr>`;
        }
    }

    const colList = document.getElementById("gestorColaboradoresList");
    colList.innerHTML = "";
    
    const orgUsers = db.usuarios.filter(u => u.fk_empresa === orgId);
    
    // Atualiza contador
    const countEl = document.getElementById('gestorColabCount');
    if (countEl) countEl.textContent = `${orgUsers.length} ${orgUsers.length === 1 ? 'funcionário' : 'funcionários'}`;
    
    // Limpa busca
    const buscaInput = document.getElementById('gestorBuscaColab');
    if (buscaInput) buscaInput.value = '';
    
    orgUsers.forEach(user => {
        const isSelf = user.matricula === currentLoggedUser.matricula;
        colList.appendChild(buildColaboradorRow(user, isSelf));
    });
    
    // 2. Renderiza Itens da Loja no Painel
    const storeList = document.getElementById("gestorStoreList");
    storeList.innerHTML = "";
    
    db.loja.forEach(item => {
        const tr = document.createElement("tr");
        
        const isProtected = item.protegido === true;
        const statusBadge = isProtected 
            ? `<span class="badge" style="background-color: #f1f5f9; color: #64748b;">Padrão Chaves</span>` 
            : `<span class="badge" style="background-color: #faf5ff; color: #7c3aed;">Personalizado</span>`;
            
        const actions = isProtected 
            ? `<span style="font-size: 0.8rem; color: var(--text-light); font-style: italic;"><i class="fa-solid fa-lock"></i> Item Protegido</span>`
            : `<button class="btn btn-secondary btn-sm" onclick="deleteGestorLojaItem('${item.id}')" style="color: var(--color-danger); padding: 4px 8px; border-color: rgba(220, 38, 38, 0.2);"><i class="fa-solid fa-trash"></i> Excluir</button>`;
            
        const photoPreview = item.foto 
            ? `<img src="${item.foto}" style="width: 32px; height: 32px; border-radius: 4px; object-fit: cover;">` 
            : `<i class="${item.icon || 'fa-solid fa-gift'}" style="font-size: 1.2rem; color: var(--color-primary-light);"></i>`;
            
        tr.innerHTML = `
            <td style="text-align: center;">${photoPreview}</td>
            <td style="font-weight: bold;">${item.nome}</td>
            <td>${item.tipo === 'global' ? 'Global' : 'Local'}</td>
            <td style="font-weight: bold; color: var(--color-warning);">⭐ ${item.custo}</td>
            <td>${item.estoque} un</td>
            <td>${statusBadge}</td>
            <td>${actions}</td>
        `;
        storeList.appendChild(tr);
    });
}

function buildColaboradorRow(user, isSelf) {
    const tr = document.createElement("tr");
    
    const roleLabel = user.role === "gestor" ? "Gestor" : "Colaborador";
    const roleClass = user.role === "gestor" ? "badge-gestor" : "badge-colaborador";
    
    const actions = isSelf 
        ? `<span style="font-size: 0.85rem; color: var(--text-muted); font-style: italic;"><i class="fa-solid fa-user-check"></i> Sua Conta</span>`
        : `<button class="btn btn-secondary btn-sm" onclick="deleteGestorColaborador('${user.matricula}')" style="color: var(--color-danger); padding: 4px 8px; border-color: rgba(220, 38, 38, 0.2);"><i class="fa-solid fa-trash"></i> Excluir</button>`;
        
    tr.innerHTML = `
        <td style="font-weight: 700; color: var(--color-primary);">${user.nome_completo}</td>
        <td><code>${user.matricula}</code></td>
        <td><code>${user.senha || "123456"}</code></td>
        <td>${user.cargo}</td>
        <td><span class="badge ${roleClass}">${roleLabel}</span></td>
        <td style="font-weight: bold; color: var(--color-warning);">⭐ ${user.saldo_estrelas}</td>
        <td>${actions}</td>
    `;
    return tr;
}

async function handleGestorRegisterColaborador(event) {
    event.preventDefault();
    const nome = document.getElementById("g_col_nome").value.trim();
    const matriculaBase = document.getElementById("g_col_matricula").value.trim();
    const senha = document.getElementById("g_col_senha").value;
    const cargo = document.getElementById("g_col_cargo").value.trim();
    const role = document.getElementById("g_col_role").value;
    const orgId = currentLoggedUser.fk_empresa;
    
    // Sincroniza dados com o servidor
    await syncWithServer();
    
    // Aplica o prefixo da empresa
    const empresaInfo = db.empresas.find(e => e.id === orgId);
    const codigo = empresaInfo ? (empresaInfo.codigo || 0) : 0;
    const matricula = `${codigo}-${matriculaBase}`;
    
    if (db.usuarios.some(u => u.matricula === matricula)) {
        alert("Já existe um colaborador cadastrado com esta matrícula.");
        return;
    }
    
    db.usuarios.push({
        id_usuario: "usr_" + matricula,
        fk_empresa: orgId,
        nome_completo: nome,
        matricula: matricula,
        cargo: cargo,
        setor: "Geral",
        saldo_estrelas: 0,
        status: "Ativo",
        senha: senha,
        role: role,
        foto: ""
    });
    
    db.extrato_por_usuario[matricula] = [
        {
            data: getCurrentFormattedDateTime(),
            tipo: "credito",
            desc: "Adesão à plataforma",
            valor: 0
        }
    ];
    
    saveDataToStorage();
    renderGestorPanel();
    event.target.reset();
    alert(`Colaborador ${nome} cadastrado! PIN de acesso: ${matricula}`);
}

async function handleGestorAddLojaItem(event) {
    event.preventDefault();
    const nome = document.getElementById("g_loja_nome").value.trim();
    const custo = parseInt(document.getElementById("g_loja_custo").value) || 1;
    const estoque = parseInt(document.getElementById("g_loja_estoque").value) || 1;
    const fotoUrl = document.getElementById("g_loja_foto_url").value.trim();
    const fotoBase64 = document.getElementById("g_loja_foto_base64").value;
    
    // Sincroniza primeiro
    await syncWithServer();
    
    // Define se usa base64 ou URL
    const foto = fotoBase64 || fotoUrl || "";
    
    const id = "item_custom_" + Date.now();
    
    db.loja.push({
        id: id,
        nome: nome,
        tipo: "local",
        custo: custo,
        estoque: estoque,
        icon: "fa-solid fa-gift",
        foto: foto,
        protegido: false
    });
    
    saveDataToStorage();
    renderGestorPanel();
    event.target.reset();
    document.getElementById("g_loja_foto_base64").value = "";
    alert(`Recompensa "${nome}" adicionada ao catálogo local com sucesso!`);
}

async function handleGestorAddTreinamento(event) {
    event.preventDefault();
    if (!currentLoggedUser || currentLoggedUser.role !== 'gestor') return;
    
    const titulo = document.getElementById("g_tr_titulo").value.trim();
    const data = document.getElementById("g_tr_data").value.trim();
    
    if (!titulo || !data) {
        alert("Preencha todos os campos.");
        return;
    }
    
    const orgId = currentLoggedUser.fk_empresa;
    const newTrainingId = `tr_${Date.now()}`;
    
    // Sincroniza primeiro
    await syncWithServer();
    
    // Busca colaboradores da empresa para popular o status_por_usuario
    const companyUsers = db.usuarios.filter(u => u.fk_empresa === orgId);
    const status_por_usuario = {};
    companyUsers.forEach(u => {
        status_por_usuario[u.matricula] = "unregistered";
    });
    
    const newTraining = {
        id: newTrainingId,
        titulo: titulo,
        data: data,
        pin: "",
        fk_empresa: orgId,
        status_por_usuario: status_por_usuario,
        matriculas_validadas: [],
        presencas_sessao: [],
        encerrado: false
    };
    
    db.treinamentos.push(newTraining);
    
    await saveDataToStorage();
    
    // Reseta form
    event.target.reset();
    alert(`Treinamento "${titulo}" agendado com sucesso!`);
    renderGestorPanel();
}

// Abre modal de edição de treinamento
function openEditTrainingModal(trainingId) {
    const tr = db.treinamentos.find(t => t.id === trainingId);
    if (!tr) return;
    if (tr.encerrado) {
        alert('Não é possível editar um treinamento já encerrado.');
        return;
    }
    document.getElementById('edit_tr_id').value = tr.id;
    document.getElementById('edit_tr_titulo').value = tr.titulo;
    document.getElementById('edit_tr_data').value = tr.data;
    document.getElementById('editTrainingModal').classList.add('active');
}

function closeEditTrainingModal() {
    document.getElementById('editTrainingModal').classList.remove('active');
}

async function saveEditTraining() {
    const id = document.getElementById('edit_tr_id').value;
    const titulo = document.getElementById('edit_tr_titulo').value.trim();
    const data = document.getElementById('edit_tr_data').value.trim();
    
    if (!titulo || !data) {
        alert('Preencha o título e a data.');
        return;
    }
    
    await syncWithServer();
    const tr = db.treinamentos.find(t => t.id === id);
    if (!tr) return;
    
    tr.titulo = titulo;
    tr.data = data;
    
    await saveDataToStorage();
    closeEditTrainingModal();
    renderGestorPanel();
    alert('Treinamento atualizado com sucesso!');
}

async function deleteGestorTreinamento(trainingId) {
    const tr = db.treinamentos.find(t => t.id === trainingId);
    if (!tr) return;
    
    if (!confirm(`Tem certeza de que deseja excluir o treinamento "${tr.titulo}"? Esta ação não pode ser desfeita.`)) return;
    
    await syncWithServer();
    db.treinamentos = db.treinamentos.filter(t => t.id !== trainingId);
    await saveDataToStorage();
    renderGestorPanel();
    alert('Treinamento removido com sucesso.');
}


async function deleteGestorColaborador(matricula) {
    if (matricula === currentLoggedUser.matricula) {
        alert("Você não pode excluir sua própria conta.");
        return;
    }
    
    if (confirm("Tem certeza de que deseja excluir este colaborador? Esta ação não pode ser desfeita.")) {
        await syncWithServer();
        db.usuarios = db.usuarios.filter(u => u.matricula !== matricula);
        delete db.extrato_por_usuario[matricula];
        await saveDataToStorage();
        renderGestorPanel();
        alert("Colaborador removido com sucesso.");
    }
}

async function deleteGestorLojaItem(itemId) {
    const item = db.loja.find(i => i.id === itemId);
    if (!item) return;
    
    if (item.protegido === true) {
        alert("Não é permitido excluir os itens padrão da Chaves Treinamentos.");
        return;
    }
    
    if (confirm(`Tem certeza de que deseja excluir o item "${item.nome}"?`)) {
        await syncWithServer();
        db.loja = db.loja.filter(i => i.id !== itemId);
        await saveDataToStorage();
        renderGestorPanel();
        alert("Item removido da loja.");
    }
}


// ==========================================================================
// CONTROLE DE PRESENÇA EM TREINAMENTOS - GESTOR & COLABORADOR
// ==========================================================================

let gestorEventSource = null;
let html5QrCodeScanner = null;
let gestorPinTimerInterval = null;

// Gera um PIN de 4 dígitos determinístico baseado no ID do treinamento e no bloco de 30 segundos atual.
// Isso garante que gestor e colaborador calculem o mesmo PIN sem precisar de requisições de rede.
function generateDynamicPIN(trainingId) {
    const block = Math.floor(Date.now() / 30000); // Muda a cada 30 segundos
    // Gera um hash simples combinando o ID do treinamento e o bloco de tempo
    let hash = 0;
    const seed = `${trainingId}_${block}`;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    // Garante 4 dígitos (1000-9999)
    const pin = (Math.abs(hash) % 9000 + 1000).toString();
    return pin;
}

// Valida um PIN contra o sessionPin salvo no banco pelo gestor ou o PIN estático do treinamento
function isValidDynamicPIN(trainingId, enteredPin) {
    if (!db || !db.treinamentos) return false;
    const tr = db.treinamentos.find(t => t.id === trainingId);
    if (!tr) return false;
    
    // Valida contra o PIN fixo da sessão salvo pelo gestor no banco de dados ou o PIN estático do treinamento
    if ((tr.sessionPin && tr.sessionPin === enteredPin) || (tr.pin && tr.pin === enteredPin)) {
        return true;
    }
    return false;
}

async function openGestorPresenceSession(trainingId) {
    const tr = db.treinamentos.find(t => t.id === trainingId);
    if (!tr) return;
    
    // Sincroniza variáveis locais e seletores
    currentActiveTrainingId = trainingId;
    const presenceSelect = document.getElementById('presenceNetworkSelect');
    if (presenceSelect) presenceSelect.value = currentSelectedIP;
    
    // 1. Monta interface do modal do Gestor
    document.getElementById("gPresenceTrainingTitle").textContent = tr.titulo;
    document.getElementById("gPresenceList").innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">Aguardando participantes...</div>`;
    
    // 2. Gera PIN fixo e aleatório para esta sessão (válido até a sessão ser fechada)
    if (gestorPinTimerInterval) clearInterval(gestorPinTimerInterval);
    
    // Gera PIN de 4 dígitos (1000-9999) uma única vez por sessão
    const sessionPinValue = (Math.floor(Math.random() * 9000) + 1000).toString();
    
    // Salva o PIN fixo no banco de dados imediatamente
    const freshTr = db.treinamentos.find(t => t.id === trainingId);
    if (freshTr) freshTr.sessionPin = sessionPinValue;
    saveDataToStorage().catch(e => console.error("Erro ao salvar sessionPin:", e));
    
    // Exibe o PIN fixo na tela do gestor
    document.getElementById("gPresencePIN").textContent = sessionPinValue;
    const countdown = document.getElementById("gPresencePINCountdown");
    if (countdown) countdown.innerHTML = `<i class="fa-solid fa-shield-halved"></i> PIN válido durante toda a sessão`;
    
    // Atualiza o QR Code com o PIN fixo
    regenerateAllQrs();
    
    // Cronômetro de quanto tempo a sessão está aberta (informativo)
    const sessionStart = Date.now();
    function updateSessionTimer() {
        const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = (elapsed % 60).toString().padStart(2, '0');
        const countdown = document.getElementById("gPresencePINCountdown");
        if (countdown) countdown.innerHTML = `<i class="fa-solid fa-shield-halved"></i> PIN: ${sessionPinValue} &nbsp;|&nbsp; <i class="fa-solid fa-clock"></i> Sessão aberta há ${mins}:${secs}`;
    }
    gestorPinTimerInterval = setInterval(updateSessionTimer, 1000);
    
    // 3. Conecta SSE para ouvir presença em tempo real
    if (gestorEventSource) {
        gestorEventSource.close();
    }
    
    const topicId = `chaves_presence_session_${trainingId}`;
    gestorEventSource = new EventSource(`https://ntfy.sh/${topicId}/sse`);
    
    let firstPresence = true;
    gestorEventSource.onmessage = (event) => {
        try {
            const rawData = JSON.parse(event.data);
            if (rawData.message) {
                const presenceData = JSON.parse(rawData.message);
                if (presenceData.nome && presenceData.setor) {
                    if (firstPresence) {
                        document.getElementById("gPresenceList").innerHTML = "";
                        firstPresence = false;
                    }
                    
                    // Verifica se já está na lista
                    const existingCards = document.querySelectorAll(`#gPresenceList [data-matricula="${presenceData.matricula}"]`);
                    if (existingCards.length === 0) {
                        const card = document.createElement("div");
                        card.dataset.matricula = presenceData.matricula;
                        card.style.cssText = "display: flex; align-items: center; gap: 10px; background: white; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--color-border); margin-bottom: 8px;";
                        card.innerHTML = `
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--color-primary-light); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; flex-shrink: 0;">
                                ${presenceData.nome.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 700; font-size: 0.85rem; color: var(--color-primary);">${presenceData.nome}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${presenceData.setor} | Matrícula: ${presenceData.matricula}</div>
                            </div>
                        `;
                        document.getElementById("gPresenceList").appendChild(card);
                    }
                }
            }
        } catch(e) {
            console.error("Erro ao decodificar presença em tempo real:", e);
        }
    };
    
    document.getElementById("gestorPresenceModal").classList.add("active");
}

function closeGestorPresenceModal() {
    document.getElementById("gestorPresenceModal").classList.remove("active");
    if (gestorEventSource) {
        gestorEventSource.close();
        gestorEventSource = null;
    }
    if (gestorPinTimerInterval) {
        clearInterval(gestorPinTimerInterval);
        gestorPinTimerInterval = null;
    }
    currentActiveTrainingId = null;
}

// Encerra o treinamento, gera relatório e marca como encerrado
async function encerrarTreinamento() {
    if (!currentActiveTrainingId) return;
    
    const tr = db.treinamentos.find(t => t.id === currentActiveTrainingId);
    if (!tr) return;
    
    if (!confirm(`Deseja encerrar o treinamento "${tr.titulo}"?\nApós encerrar, ele não aparecerá mais para os colaboradores.`)) return;
    
    // Registra hora de encerramento e calcula duração de cada participante
    const tsEncerramento = Date.now();
    const horaEncerramento = new Date(tsEncerramento);
    const horaEncerramentoStr = `${String(horaEncerramento.getHours()).padStart(2,'0')}:${String(horaEncerramento.getMinutes()).padStart(2,'0')}:${String(horaEncerramento.getSeconds()).padStart(2,'0')}`;
    
    if (!tr.presencas_sessao) tr.presencas_sessao = [];
    
    // Preenche hora_saida para quem ainda não tem
    tr.presencas_sessao.forEach(p => {
        if (!p.hora_saida) {
            p.hora_saida = horaEncerramentoStr;
            p.hora_saida_ts = tsEncerramento;
        }
    });
    
    // Marca o treinamento como encerrado
    tr.encerrado = true;
    tr.encerrado_em = getCurrentFormattedDateTime();
    tr.sessionPin = null; // Invalida o PIN
    
    await syncWithServer();
    // Aplica as mudanças ao banco atual (reaplica após sync)
    const trFresh = db.treinamentos.find(t => t.id === currentActiveTrainingId);
    if (trFresh) {
        trFresh.encerrado = true;
        trFresh.encerrado_em = tr.encerrado_em;
        trFresh.sessionPin = null;
        if (!trFresh.presencas_sessao) trFresh.presencas_sessao = [];
        tr.presencas_sessao.forEach(p => {
            const existente = trFresh.presencas_sessao.find(ep => ep.matricula === p.matricula);
            if (existente) {
                existente.hora_saida = p.hora_saida;
                existente.hora_saida_ts = p.hora_saida_ts;
            } else {
                trFresh.presencas_sessao.push(p);
            }
        });
    }
    
    await saveDataToStorage();
    
    // Fecha o modal de projeção
    closeGestorPresenceModal();
    
    // Atualiza painel
    renderGestorPanel();
    
    // Exibe o relatório
    showRelatorioModal(trFresh || tr);
}

// Exibe o relatório de um treinamento já encerrado
function verRelatorioEncerrado(trainingId) {
    const tr = db.treinamentos.find(t => t.id === trainingId);
    if (!tr) return;
    showRelatorioModal(tr);
}

function showRelatorioModal(tr) {
    const presencas = tr.presencas_sessao || [];
    
    // Título
    document.getElementById('relatorioTrainingTitle').textContent = 
        `${tr.titulo}  |  Data: ${tr.data}  |  Encerrado em: ${tr.encerrado_em || getCurrentFormattedDateTime()}`;
    
    // Cards de resumo
    const header = document.getElementById('relatorioHeader');
    header.innerHTML = [
        { label: 'Total de Participantes', value: presencas.length, icon: 'fa-users', color: '#0f4c81' },
        { label: 'Treinamento', value: tr.titulo, icon: 'fa-graduation-cap', color: '#2563eb', small: true },
        { label: 'Encerrado em', value: tr.encerrado_em || '—', icon: 'fa-clock', color: '#059669' }
    ].map(c => `
        <div style="background:var(--color-bg-light);border:1px solid var(--color-border);border-radius:10px;padding:14px 16px;">
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">
                <i class="fa-solid ${c.icon}" style="color:${c.color};margin-right:4px;"></i>${c.label}
            </div>
            <div style="font-size:${c.small ? '0.85rem' : '1.4rem'};font-weight:800;color:${c.color};">${c.value}</div>
        </div>
    `).join('');
    
    // Tabela
    const tbody = document.getElementById('relatorioTableBody');
    const emptyEl = document.getElementById('relatorioEmpty');
    tbody.innerHTML = '';
    
    if (presencas.length === 0) {
        emptyEl.style.display = 'block';
    } else {
        emptyEl.style.display = 'none';
        presencas.forEach((p, idx) => {
            // Calcula duração
            let duracao = '—';
            if (p.hora_entrada_ts && p.hora_saida_ts) {
                const diffMs = p.hora_saida_ts - p.hora_entrada_ts;
                const mins = Math.floor(diffMs / 60000);
                const secs = Math.floor((diffMs % 60000) / 1000);
                duracao = `${mins}m ${secs}s`;
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="font-weight:700;color:var(--text-muted);">${idx + 1}</td>
                <td style="font-weight:700;color:var(--color-primary);">${p.nome}</td>
                <td>${p.setor || '—'}</td>
                <td><code style="font-size:0.82rem;">${p.matricula}</code></td>
                <td style="font-weight:600;">${p.hora_entrada || '—'}</td>
                <td>
                    <span style="display:inline-flex;align-items:center;gap:4px;background:var(--color-success-bg);color:var(--color-success);border-radius:20px;padding:3px 10px;font-size:0.78rem;font-weight:700;">
                        <i class="fa-solid fa-clock"></i> ${duracao}
                    </span>
                </td>
            `;
            tbody.appendChild(row);
        });
    }
    
    document.getElementById('relatorioModal').classList.add('active');
}

function closeRelatorioModal() {
    document.getElementById('relatorioModal').classList.remove('active');
}

function imprimirRelatorio() {
    window.print();
}

function openEmployeeScannerModal(trainingId) {
    currentActiveTrainingId = trainingId;
    document.getElementById("employeeScannerModal").classList.add("active");
    switchEmployeeValidationMethod('camera');
}

function closeEmployeeScannerModal(transitioningToDataModal = false) {
    document.getElementById("employeeScannerModal").classList.remove("active");
    stopQrScanner();
    // Apenas limpa a referência se o modal de preenchimento de dados não estiver ativo
    if (!transitioningToDataModal && !document.getElementById("employeeDataModal").classList.contains("active")) {
        currentActiveTrainingId = null;
    }
}

function closeEmployeeDataModal() {
    document.getElementById("employeeDataModal").classList.remove("active");
    currentActiveTrainingId = null;
}

function switchEmployeeValidationMethod(method) {
    const tabCamera = document.getElementById("eTabCamera");
    const tabPin = document.getElementById("eTabPin");
    const methodCamera = document.getElementById("eMethodCameraContainer");
    const methodPin = document.getElementById("eMethodPinContainer");
    
    if (method === 'camera') {
        tabCamera.classList.add("active");
        tabPin.classList.remove("active");
        methodCamera.classList.add("active");
        methodPin.classList.remove("active");
        
        startQrScanner();
    } else {
        tabCamera.classList.remove("active");
        tabPin.classList.add("active");
        methodCamera.classList.remove("active");
        methodPin.classList.add("active");
        
        stopQrScanner();
        document.getElementById("ePinDigit1").focus();
    }
}

function startQrScanner() {
    if (html5QrCodeScanner) {
        stopQrScanner();
    }
    
    document.getElementById("scannerErrorMessage").style.display = "none";
    
    // Limpa os inputs de arquivo
    const fileInputCamera = document.getElementById("qrFileInputCamera");
    const fileInputGallery = document.getElementById("qrFileInputGallery");
    if (fileInputCamera) fileInputCamera.value = "";
    if (fileInputGallery) fileInputGallery.value = "";
    
    const scannerReader = document.getElementById("qrScannerReader");
    if (scannerReader) scannerReader.style.display = "none"; // Começa escondido, mostra se câmera ao vivo iniciar
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        const instruction = document.getElementById("cameraInstruction");
        if (instruction) instruction.textContent = "Escolha uma opção de leitura interna de QR Code:";
    } else {
        // No desktop, tenta iniciar a câmera ao vivo automaticamente
        startLiveScannerDirectly();
    }
}

function startLiveScannerDirectly() {
    const scannerReader = document.getElementById("qrScannerReader");
    if (scannerReader) scannerReader.style.display = "block";
    
    if (html5QrCodeScanner) {
        stopQrScanner();
    }
    
    html5QrCodeScanner = new Html5Qrcode("qrScannerReader");
    const config = { fps: 10, qrbox: { width: 220, height: 220 } };
    
    html5QrCodeScanner.start({ facingMode: "environment" }, config, processQrCodeResult)
        .catch(err => {
            console.error("Erro ao iniciar câmera ao vivo:", err);
            showScannerError("Não foi possível acessar a câmera ao vivo (comum em conexões HTTP inseguras). Use a câmera nativa ou escolha da galeria.");
            if (scannerReader) scannerReader.style.display = "none";
        });
}

function processQrCodeResult(decodedText) {
    try {
        const url = new URL(decodedText);
        const action = url.searchParams.get("action");
        const trainingId = url.searchParams.get("training");
        const pin = url.searchParams.get("pin");
        
        if (action === 'presence' && trainingId === currentActiveTrainingId) {
            const tr = db.treinamentos.find(t => t.id === currentActiveTrainingId);
            if (tr && isValidDynamicPIN(tr.id, pin)) {
                stopQrScanner();
                closeEmployeeScannerModal(true);
                
                document.getElementById("ep_nome").value = currentLoggedUser.nome_completo || "";
                document.getElementById("ep_setor").value = currentLoggedUser.setor || "";
                document.getElementById("employeeDataModal").classList.add("active");
            } else {
                showScannerError("QR Code com PIN inválido ou expirado.");
            }
        } else {
            showScannerError("QR Code inválido para este treinamento.");
        }
    } catch(e) {
        showScannerError("QR Code não reconhecido como link de presença.");
    }
}

function handleQrFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    document.getElementById("scannerErrorMessage").style.display = "none";
    
    let scannerInstance = html5QrCodeScanner;
    if (!scannerInstance) {
        scannerInstance = new Html5Qrcode("qrScannerReader");
    }
    
    scannerInstance.scanFile(file, true)
        .then(decodedText => {
            processQrCodeResult(decodedText);
        })
        .catch(err => {
            console.error("Erro ao ler arquivo de QR Code:", err);
            showScannerError("Não foi possível detectar um QR Code válido na imagem. Certifique-se de que a imagem está nítida ou tente com outro print.");
        });
}

function stopQrScanner() {
    if (html5QrCodeScanner) {
        html5QrCodeScanner.stop().then(() => {
            html5QrCodeScanner = null;
            const scannerReader = document.getElementById("qrScannerReader");
            if (scannerReader) scannerReader.style.display = "none";
        }).catch(err => {
            console.error("Erro ao parar scanner:", err);
            html5QrCodeScanner = null;
            const scannerReader = document.getElementById("qrScannerReader");
            if (scannerReader) scannerReader.style.display = "none";
        });
    } else {
        const scannerReader = document.getElementById("qrScannerReader");
        if (scannerReader) scannerReader.style.display = "none";
    }
}

function showScannerError(msg) {
    const errDiv = document.getElementById("scannerErrorMessage");
    errDiv.textContent = msg;
    errDiv.style.display = "block";
}

function moveEPinFocus(input, index) {
    if (input.value.length === 1 && index < 4) {
        document.getElementById(`ePinDigit${index + 1}`).focus();
    }
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && input.value.length === 0 && index > 1) {
            document.getElementById(`ePinDigit${index - 1}`).focus();
        }
    });
}

async function submitEmployeePinValidation() {
    // Guarda o ID localmente antes do await para evitar race condition
    const trainingId = currentActiveTrainingId;
    const entered = `${document.getElementById("ePinDigit1").value}${document.getElementById("ePinDigit2").value}${document.getElementById("ePinDigit3").value}${document.getElementById("ePinDigit4").value}`;
    
    if (!trainingId) {
        const errDiv = document.getElementById("ePinErrorMessage");
        errDiv.style.display = "block";
        errDiv.textContent = "Sessão expirada. Feche e abra novamente.";
        return;
    }
    
    if (entered.length < 4) {
        const errDiv = document.getElementById("ePinErrorMessage");
        errDiv.style.display = "block";
        errDiv.textContent = "Digite os 4 dígitos do PIN.";
        setTimeout(() => { errDiv.style.display = "none"; errDiv.textContent = "PIN incorreto. Tente novamente."; }, 3000);
        return;
    }
    
    // Sincroniza para obter o sessionPin mais recente salvo pelo gestor
    await syncWithServer();
    
    const tr = db.treinamentos.find(item => item.id === trainingId);
    
    // Verifica se o gestor abriu a sessão
    if (!tr) {
        const errDiv = document.getElementById("ePinErrorMessage");
        errDiv.style.display = "block";
        errDiv.textContent = "Treinamento não encontrado. Recarregue a página.";
        return;
    }
    
    if (!tr.sessionPin && !tr.pin) {
        const errDiv = document.getElementById("ePinErrorMessage");
        errDiv.style.display = "block";
        errDiv.textContent = "O gestor ainda não iniciou a sessão de presença. Aguarde.";
        setTimeout(() => { errDiv.style.display = "none"; }, 4000);
        return;
    }
    
    if (isValidDynamicPIN(tr.id, entered)) {
        currentActiveTrainingId = trainingId; // Garante que ainda está definido
        closeEmployeeScannerModal(true);
        const userName = currentLoggedUser ? (currentLoggedUser.nome_completo || "") : "";
        const userSetor = currentLoggedUser ? (currentLoggedUser.setor || "") : "";
        document.getElementById("ep_nome").value = userName;
        document.getElementById("ep_setor").value = userSetor;
        document.getElementById("employeeDataModal").classList.add("active");
    } else {
        const errDiv = document.getElementById("ePinErrorMessage");
        errDiv.style.display = "block";
        errDiv.textContent = "PIN incorreto. Tente novamente.";
        setTimeout(() => { errDiv.style.display = "none"; }, 3000);
        for (let i = 1; i <= 4; i++) document.getElementById(`ePinDigit${i}`).value = "";
        document.getElementById("ePinDigit1").focus();
    }
}

async function submitEmployeePresenceData(event) {
    if (event) event.preventDefault();

    
    // Captura o trainingId ANTES dos awaits para evitar race condition
    const trainingId = currentActiveTrainingId;
    const nome = document.getElementById("ep_nome").value.trim();
    const setor = document.getElementById("ep_setor").value.trim();
    
    if (!nome || !setor) {
        alert("Preencha todos os campos.");
        return;
    }
    
    if (!trainingId) {
        alert("Erro: Sessão expirada. Feche e tente novamente.");
        return;
    }
    
    const tr = db.treinamentos.find(t => t.id === trainingId);
    if (!tr) {
        alert("Erro: Treinamento não encontrado.");
        return;
    }
    
    if (!currentLoggedUser) {
        alert("Erro: Sessão não encontrada. Faça login novamente.");
        return;
    }
    
    const mat = currentLoggedUser.matricula;
    
    // 1. Sincroniza dados com o servidor
    await syncWithServer();
    
    const freshTr = db.treinamentos.find(t => t.id === trainingId);
    if (freshTr) {
        if (!freshTr.matriculas_validadas.includes(mat)) {
            freshTr.matriculas_validadas.push(mat);
        }
        
        // Registra presença na sessão (para o relatório do gestor)
        if (!freshTr.presencas_sessao) freshTr.presencas_sessao = [];
        const jaRegistrado = freshTr.presencas_sessao.some(p => p.matricula === mat);
        if (!jaRegistrado) {
            const agora = new Date();
            const horaEntrada = `${String(agora.getHours()).padStart(2,'0')}:${String(agora.getMinutes()).padStart(2,'0')}:${String(agora.getSeconds()).padStart(2,'0')}`;
            freshTr.presencas_sessao.push({
                matricula: mat,
                nome: nome,
                setor: setor || 'N/A',
                hora_entrada: horaEntrada,
                hora_entrada_ts: Date.now()
            });
        }
    }
    
    // Credita estrela
    if (currentLoggedUser) {
        currentLoggedUser.saldo_estrelas += 1;
        const dbUser = db.usuarios.find(u => u.matricula === mat);
        if (dbUser) dbUser.saldo_estrelas = currentLoggedUser.saldo_estrelas;
    }
    
    // Lançamento de extrato
    if (!db.extrato_por_usuario[mat]) db.extrato_por_usuario[mat] = [];
    db.extrato_por_usuario[mat].push({
        data: getCurrentFormattedDateTime(),
        tipo: "credito",
        desc: `Presença Validada no treinamento: ${tr.titulo}`,
        valor: 1
    });
    
    // 2. Salva no banco de dados do servidor
    await saveDataToStorage();
    
    // Atualiza a interface gráfica do portal imediatamente
    updatePortalDashboard();
    
    // 3. Notifica o gestor via ntfy.sh
    const topicId = `chaves_presence_session_${trainingId}`;
    const payload = {
        nome: nome,
        setor: setor,
        matricula: mat
    };
    
    try {
        await fetch(`https://ntfy.sh/${topicId}`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Title': 'Presença Confirmada',
                'Tags': 'white_check_mark'
            }
        });
    } catch(e) {
        console.error("Erro ao enviar presença via ntfy:", e);
    }
    
    // Fecha modal
    document.getElementById("employeeDataModal").classList.remove("active");
    
    // 4. Mostra confirmação de presença exclusivamente no telemóvel do colaborador
    document.getElementById("successQrImageWrapper").style.display = "flex";
    document.getElementById("successIconWrapper").style.display = "none";
    document.getElementById("successModalTitle").textContent = "Presença Confirmada!";
    document.getElementById("successModalText").textContent = `Sua presença no treinamento "${tr.titulo}" foi validada com sucesso! +1 Estrela!`;
    document.getElementById("successModal").classList.add("active");
    
    currentActiveTrainingId = null;
}

function openDirectPresenceValidation(trainingId, pin) {
    const tr = db.treinamentos.find(t => t.id === trainingId);
    if (!tr) {
        alert("Treinamento não encontrado.");
        return;
    }
    
    if (isValidDynamicPIN(trainingId, pin)) {
        currentActiveTrainingId = trainingId;
        const userName = currentLoggedUser ? (currentLoggedUser.nome_completo || "") : "";
        const userSetor = currentLoggedUser ? (currentLoggedUser.setor || "") : "";
        document.getElementById("ep_nome").value = userName;
        document.getElementById("ep_setor").value = userSetor;
        document.getElementById("employeeDataModal").classList.add("active");
    } else {
        alert("O PIN deste QR Code expirou ou é inválido. Peça ao gestor o PIN atual.");
    }
}


// ==========================================================================
// INICIALIZAÇÃO DA APLICAÇÃO E LISTENERS
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

// Fecha modais com cliques fora do card
window.addEventListener("click", (event) => {
    if (event.target === document.getElementById("validatorModal")) closeValidatorModal();
    if (event.target === document.getElementById("successModal")) closeSuccessModal();
    if (event.target === document.getElementById("voucherModal")) closeVoucherModal();
    if (event.target === document.getElementById("employeeScannerModal")) closeEmployeeScannerModal();
    if (event.target === document.getElementById("gestorPresenceModal")) closeGestorPresenceModal();
    if (event.target === document.getElementById("employeeDataModal")) closeEmployeeDataModal();
});

// Fechar com tecla ESC
window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeValidatorModal();
        closeSuccessModal();
        closeVoucherModal();
        closeEmployeeScannerModal();
        closeGestorPresenceModal();
        closeEmployeeDataModal();
    }
});

// ==========================================================================
// FUNÇÕES DE GERENCIAMENTO DE IP E QR CODE MULTI-INTERFACE
// ==========================================================================

function populateNetworkSelectors() {
    const ids = ['loginNetworkSelect', 'gestorNetworkSelect', 'presenceNetworkSelect'];
    const containers = ['loginNetworkSelectContainer', 'gestorNetworkSelectContainer', 'presenceNetworkSelectContainer'];
    const showSelectors = serverIPs.length > 1;
    
    containers.forEach((containerId, idx) => {
        const container = document.getElementById(containerId);
        if (container) {
            container.style.display = showSelectors ? 'block' : 'none';
        }
        
        const select = document.getElementById(ids[idx]);
        if (select) {
            select.innerHTML = '';
            serverIPs.forEach(ipObj => {
                const opt = document.createElement('option');
                opt.value = ipObj.address;
                opt.textContent = `${ipObj.name} (${ipObj.address})`;
                select.appendChild(opt);
            });
            select.value = currentSelectedIP;
        }
    });
}

function changeSelectedIP(newIP) {
    currentSelectedIP = newIP;
    serverIP = newIP;
    
    // Sincroniza os dropdowns
    const ids = ['loginNetworkSelect', 'gestorNetworkSelect', 'presenceNetworkSelect'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = newIP;
    });
    
    // Regenera os QR codes ativos
    regenerateAllQrs();
}

function getQrHostAndPort() {
    const isLocal = (window.location.protocol === 'file:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' || 
                     window.location.hostname === '');
    const host = isLocal ? currentSelectedIP : window.location.hostname;
    const port = (window.location.protocol === 'file:' || window.location.hostname === '') 
                 ? '3000' 
                 : window.location.port;
    const portSuffix = port ? `:${port}` : '';
    return { host, portSuffix };
}

function renderQRCodeOnCanvas(canvasId, text, width, margin = 2, colors = { dark: '#000000', light: '#ffffff' }) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    // Tenta renderizar usando a biblioteca local se disponível
    if (typeof QRCode !== 'undefined' && typeof QRCode.toCanvas === 'function') {
        QRCode.toCanvas(canvas, text, {
            width: width,
            margin: margin,
            color: {
                dark: colors.dark,
                light: colors.light
            }
        }, function(error) {
            if (error) {
                console.error('Erro ao gerar QR Code localmente, usando fallback:', error);
                renderQRCodeFallback(canvas, text, width);
            }
        });
    } else {
        // Usa fallback via API externa
        renderQRCodeFallback(canvas, text, width);
    }
}

function renderQRCodeFallback(canvas, text, width) {
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
        canvas.width = width;
        canvas.height = width;
        ctx.clearRect(0, 0, width, width);
        ctx.drawImage(img, 0, 0, width, width);
    };
    img.onerror = function() {
        console.error('Erro ao carregar o fallback do QR Code via API pública.');
    };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${width}x${width}&data=${encodeURIComponent(text)}`;
}

function regenerateAllQrs() {
    const { host, portSuffix } = getQrHostAndPort();
    
    // 1. QR Code de Login Mobile
    const mobileLoginURL = `http://${host}${portSuffix}/index.html?view=portal`;
    renderQRCodeOnCanvas("loginMobileQRCode", mobileLoginURL, 130, 1, { dark: '#0f4c81', light: '#ffffff' });
    
    // 2. QR Code de Auto-Cadastro do Gestor
    if (currentLoggedUser && currentLoggedUser.role === 'gestor') {
        const orgId = currentLoggedUser.fk_empresa;
        const company = db.empresas.find(e => e.id === orgId);
        if (company) {
            const cadastroURL = `http://${host}${portSuffix}/cadastro_colaborador.html?empresa=${orgId}&codigo=${company.codigo || 0}&nome=${encodeURIComponent(company.nome_fantasia)}`;
            const qrLoading = document.getElementById('qrLoading');
            const qrLabel = document.getElementById('qrUrlLabel');
            
            renderQRCodeOnCanvas("gestorQRCode", cadastroURL, 160, 2, { dark: '#0d3b6e', light: '#f0f9ff' });
            
            if (qrLoading) qrLoading.style.display = 'none';
            const qrCanvas = document.getElementById('gestorQRCode');
            if (qrCanvas) qrCanvas.style.display = 'inline-block';
            if (qrLabel) qrLabel.textContent = cadastroURL;
        }
    }
    
    // 3. QR Code de Presença do Gestor
    if (currentActiveTrainingId && document.getElementById("gestorPresenceModal").classList.contains("active")) {
        const tr = db.treinamentos.find(t => t.id === currentActiveTrainingId);
        if (tr && tr.sessionPin) {
            const presenceURL = `http://${host}${portSuffix}/index.html?action=presence&training=${currentActiveTrainingId}&pin=${tr.sessionPin}`;
            renderQRCodeOnCanvas("gPresenceQRCode", presenceURL, 200, 1, { dark: '#0f4c81', light: '#ffffff' });
        }
    }
}

// ==========================================================================
// CHAT INTERNO (WebSocket & Visualização com Canais e DMs)
// ==========================================================================

let chatSocket = null;
let chatActiveTarget = 'geral'; // 'geral' ou matricula do destinatário
let chatMessagesByTarget = { 'geral': [] }; // Dicionário de mensagens agrupadas por target
let chatUnreadCounts = {}; // Contador de mensagens não lidas por target
let chatSelectedFileBase64 = null;
let chatSelectedFileName = null;
let chatSelectedFileType = null;

// Inicializa a conexão com o WebSocket
function initChatWebSocket() {
    if (!currentLoggedUser) return;
    
    // Fecha socket anterior se houver
    if (chatSocket) {
        try { chatSocket.close(); } catch(e) {}
    }
    
    // Determina a URL do WebSocket a partir da URL da API
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = apiBase.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProto}//${wsHost}`;
    
    console.log(`Conectando ao chat WebSocket em ${wsUrl}`);
    chatSocket = new WebSocket(wsUrl);
    
    chatSocket.onopen = () => {
        console.log("WebSocket conectado com sucesso.");
        
        // Envia mensagem de join
        chatSocket.send(JSON.stringify({
            type: 'join',
            empresaId: currentLoggedUser.fk_empresa,
            userInfo: {
                nome: currentLoggedUser.nome_completo,
                matricula: currentLoggedUser.matricula
            },
            isGestor: currentLoggedUser.role === 'gestor'
        }));
        
        // Reseta estados locais
        chatMessagesByTarget = { 'geral': [] };
        
        // Se for gestor, busca alertas antigos persistidos
        if (currentLoggedUser.role === 'gestor') {
            loadGestorModerationAlerts();
        }
    };
    
    chatSocket.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            return;
        }
        
        if (msg.type === 'history') {
            // Histórico inicial enviado pelo servidor
            msg.messages.forEach(m => {
                const targetKey = String(m.target || 'geral').trim();
                const myMat = String(currentLoggedUser.matricula).trim();
                
                let key = targetKey;
                if (targetKey !== 'geral') {
                    const autorMat = String(m.autor.matricula).trim();
                    // Se fui eu quem enviou, agrupa pela matrícula do destinatário
                    // Se foi o outro quem enviou, agrupa pela matrícula do autor
                    key = autorMat === myMat ? targetKey : autorMat;
                }
                
                if (!chatMessagesByTarget[key]) chatMessagesByTarget[key] = [];
                // Evita duplicados
                if (!chatMessagesByTarget[key].some(existing => existing.id === m.id)) {
                    chatMessagesByTarget[key].push(m);
                }
            });
            
            // Renderiza a sidebar de contatos e as mensagens da aba ativa
            renderChatSidebar();
            renderChatMessages();
            
        } else if (msg.type === 'message') {
            const m = msg.message;
            const targetKey = String(m.target || 'geral').trim();
            const myMat = String(currentLoggedUser.matricula).trim();
            
            let key = targetKey;
            if (targetKey !== 'geral') {
                const autorMat = String(m.autor.matricula).trim();
                key = autorMat === myMat ? targetKey : autorMat;
            }
            
            if (!chatMessagesByTarget[key]) chatMessagesByTarget[key] = [];
            chatMessagesByTarget[key].push(m);
            
            // Incrementa contador de não lidas se não for o target atual
            if (String(chatActiveTarget).trim() !== key) {
                chatUnreadCounts[key] = (chatUnreadCounts[key] || 0) + 1;
                updateChatUnreadBadgeCount();
            }
            
            // Atualiza visualização
            renderChatSidebar();
            if (String(chatActiveTarget).trim() === key) {
                renderChatMessages();
            }
            
            // Se for o gestor olhando o Monitor de Conversas, atualiza o Monitor
            if (currentLoggedUser.role === 'gestor') {
                renderGestorChatFeed();
            }
            
        } else if (msg.type === 'moderation_alert') {
            // Recebeu um alerta de moderação instantâneo (apenas gestor)
            if (currentLoggedUser.role === 'gestor') {
                handleIncomingModerationAlert(msg.alert);
            }
        }
    };
    
    chatSocket.onerror = (err) => {
        console.error("Erro na conexão WebSocket do chat:", err);
    };
    
    chatSocket.onclose = () => {
        console.log("WebSocket do chat desconectado. Tentando reconectar em 5 segundos...");
        setTimeout(initChatWebSocket, 5000);
    };
}

// Atualiza o crachá/badge vermelho com o total de mensagens não lidas no menu do chat
function updateChatUnreadBadgeCount() {
    let totalUnread = 0;
    for (const key of Object.keys(chatUnreadCounts)) {
        totalUnread += chatUnreadCounts[key] || 0;
    }
    
    const badge = document.getElementById("chatUnreadBadge");
    if (badge) {
        if (totalUnread > 0) {
            badge.textContent = totalUnread;
            badge.style.display = "inline-flex";
        } else {
            badge.style.display = "none";
        }
    }
}

// Toggle da sidebar de contatos no mobile
function toggleChatSidebarMobile() {
    const sidebar = document.getElementById("chatContactsSidebar");
    const chevron = document.getElementById("chatSidebarChevron");
    if (!sidebar) return;
    
    // Só faz toggle em telas pequenas
    if (window.innerWidth <= 768) {
        const isOpen = sidebar.classList.toggle("mobile-open");
        if (chevron) {
            chevron.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
        }
    }
}

// Popula a sidebar do chat com o Grupo Geral e a lista de colaboradores (DMs)
function renderChatSidebar() {
    const listContainer = document.getElementById("chatContactsList");
    if (!listContainer) return;
    
    listContainer.innerHTML = "";
    
    const company = db.empresas.find(e => e.id === currentLoggedUser.fk_empresa);
    const companyName = company ? company.nome_fantasia : "Minha Empresa";
    
    // 1. Canal Geral da Empresa
    const geralItem = document.createElement("div");
    geralItem.className = `chat-contact-item ${chatActiveTarget === 'geral' ? 'active' : ''}`;
    geralItem.onclick = () => selectChatTarget('geral');
    
    const geralUnread = chatUnreadCounts['geral'] || 0;
    const geralBadgeHtml = geralUnread > 0 ? `<span class="chat-contact-badge">${geralUnread}</span>` : '';
    
    geralItem.innerHTML = `
        <div class="chat-contact-avatar general">
            <i class="fa-solid fa-users"></i>
        </div>
        <div style="flex:1;">
            <div style="font-weight:700;">📢 Grupo Geral</div>
            <div style="font-size:0.7rem; opacity:0.8;">Chat corporativo da empresa</div>
        </div>
        ${geralBadgeHtml}
    `;
    listContainer.appendChild(geralItem);
    
    // Cabeçalho de Mensagens Diretas (DMs)
    const dmHeader = document.createElement("div");
    dmHeader.style = "font-size:0.7rem; font-weight:700; color:var(--text-light); text-transform:uppercase; margin:14px 0 8px 8px; letter-spacing:0.5px;";
    dmHeader.textContent = "Mensagens Diretas";
    listContainer.appendChild(dmHeader);
    
    // 2. Todos os usuários da mesma empresa (excluindo o próprio usuário logado)
    // Inclui gestor para que funcionários possam enviar DMs para ele
    const coworkers = db.usuarios.filter(u =>
        u.fk_empresa === currentLoggedUser.fk_empresa &&
        u.matricula !== currentLoggedUser.matricula
    );
    
    // Ordena: gestores primeiro, depois colaboradores
    coworkers.sort((a, b) => {
        if (a.role === 'gestor' && b.role !== 'gestor') return -1;
        if (a.role !== 'gestor' && b.role === 'gestor') return 1;
        return a.nome_completo.localeCompare(b.nome_completo);
    });
    
    if (coworkers.length === 0) {
        const noCoworkers = document.createElement("div");
        noCoworkers.style = "font-size:0.75rem; color:var(--text-light); text-align:center; padding:10px; font-style:italic;";
        noCoworkers.textContent = "Nenhum outro usuário cadastrado.";
        listContainer.appendChild(noCoworkers);
        return;
    }
    
    coworkers.forEach(user => {
        const userMat = user.matricula;
        const isActive = chatActiveTarget === userMat;
        const isGestorUser = user.role === 'gestor';
        
        const userUnread = chatUnreadCounts[userMat] || 0;
        const userBadgeHtml = userUnread > 0 ? `<span class="chat-contact-badge">${userUnread}</span>` : '';
        
        const initials = user.nome_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
        const roleBadge = isGestorUser
            ? `<div style="font-size:0.6rem; font-weight:700; color:var(--color-primary-light); text-transform:uppercase; letter-spacing:0.5px;">👔 Gestor</div>`
            : `<div style="font-size:0.7rem; opacity:0.8;">${user.cargo || 'Funcionário'}</div>`;
        const avatarStyle = isGestorUser
            ? 'background: linear-gradient(135deg, #b45309, #d97706);'
            : '';
        
        const userItem = document.createElement("div");
        userItem.className = `chat-contact-item ${isActive ? 'active' : ''}`;
        userItem.onclick = () => selectChatTarget(userMat);
        
        userItem.innerHTML = `
            <div class="chat-contact-avatar" style="${avatarStyle}">
                ${initials}
                <span class="chat-contact-status online"></span>
            </div>
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                <div style="font-weight:700;">${user.nome_completo}</div>
                ${roleBadge}
            </div>
            ${userBadgeHtml}
        `;
        listContainer.appendChild(userItem);
    });
}

// Alterna a conversa aberta
function selectChatTarget(target) {
    chatActiveTarget = String(target).trim();
    // Marca mensagens como lidas
    chatUnreadCounts[chatActiveTarget] = 0;
    updateChatUnreadBadgeCount();
    
    // Atualiza sidebar
    renderChatSidebar();
    
    // Atualiza cabeçalho e mensagens
    updateChatHeader();
    renderChatMessages();
}

// Atualiza as informações do cabeçalho da janela de mensagens ativa
function updateChatHeader() {
    const titleEl = document.getElementById("chatActiveTitle");
    const subtitleEl = document.getElementById("chatActiveSubtitle");
    const iconEl = document.getElementById("chatActiveIcon");
    
    if (!titleEl || !subtitleEl || !iconEl) return;
    
    if (chatActiveTarget === 'geral') {
        const company = db.empresas.find(e => e.id === currentLoggedUser.fk_empresa);
        titleEl.textContent = "📢 Grupo Geral da Empresa";
        subtitleEl.textContent = `Todos os colaboradores de ${company ? company.nome_fantasia : 'sua organização'}`;
        iconEl.className = "fa-solid fa-users";
    } else {
        const otherUser = db.usuarios.find(u => u.matricula === chatActiveTarget);
        titleEl.textContent = otherUser ? otherUser.nome_completo : `Colaborador (${chatActiveTarget})`;
        subtitleEl.textContent = otherUser ? `${otherUser.cargo} | Matrícula ${otherUser.matricula}` : "Mensagem Direta Privada";
        iconEl.className = "fa-solid fa-user";
    }
}

// Renderiza o feed de mensagens da conversa ativa
function renderChatMessages() {
    const feed = document.getElementById("chatFeed");
    if (!feed) return;
    
    feed.innerHTML = "";
    
    const messages = chatMessagesByTarget[chatActiveTarget] || [];
    
    if (messages.length === 0) {
        feed.innerHTML = `
            <div id="chatFeedEmpty" style="text-align:center; color:var(--text-muted); padding:40px 20px; font-size:0.9rem;">
                <i class="fa-solid fa-comments" style="font-size:2rem; display:block; margin-bottom:10px; opacity:0.3;"></i>
                Seja o primeiro a enviar uma mensagem nesta conversa!
            </div>
        `;
        return;
    }
    
    messages.forEach(m => {
        const isOutgoing = m.autor.matricula === currentLoggedUser.matricula;
        const bubbleWrapper = document.createElement("div");
        bubbleWrapper.className = `chat-msg-bubble-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;
        
        const dateObj = new Date(m.timestamp);
        const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        let textContent = m.text || '';
        let mediaHtml = '';
        
        // Se a mensagem foi marcada como imprópria
        let flaggedClass = '';
        if (m.flagged) {
            flaggedClass = 'flagged';
            textContent = `<i class="fa-solid fa-shield-halved"></i> <em>Esta mensagem foi sinalizada e ocultada pelo filtro automático de moderação.</em>`;
        } else if (m.mediaType) {
            // Renderiza o arquivo se houver
            if (m.mediaType === 'image') {
                const imgSrc = m.mediaData && m.mediaData !== '[MEDIA]' ? m.mediaData : 'https://placehold.co/300x150?text=Imagem+Anexada';
                mediaHtml = `
                    <div style="margin-bottom:6px; border-radius:8px; overflow:hidden; border:1px solid var(--color-border); max-width:260px;">
                        <img src="${imgSrc}" style="width:100%; display:block; cursor:pointer;" onclick="window.open('${imgSrc}')">
                    </div>
                `;
            } else {
                mediaHtml = `
                    <div style="background:rgba(255,255,255,0.25); color:inherit; padding:8px 12px; border-radius:8px; display:inline-flex; align-items:center; gap:10px; margin-bottom:6px; font-size:0.8rem; font-weight:600;">
                        <i class="fa-solid fa-file-pdf" style="font-size:1.2rem;"></i>
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">${m.mediaName || 'Documento'}</span>
                        <a href="${m.mediaData && m.mediaData !== '[MEDIA]' ? m.mediaData : '#'}" download="${m.mediaName || 'anexo'}" style="color:var(--color-primary-light); cursor:pointer; background:white; padding:4px 8px; border-radius:4px; font-size:0.7rem; text-decoration:none;"><i class="fa-solid fa-download"></i> Baixar</a>
                    </div>
                `;
            }
        }
        
        const authorName = isOutgoing ? "Você" : m.autor.nome;
        
        bubbleWrapper.innerHTML = `
            <div class="chat-msg-meta">
                <strong>${authorName}</strong>
                <span>${m.autor.matricula}</span>
            </div>
            <div class="chat-msg-bubble ${flaggedClass}">
                ${mediaHtml}
                <div>${textContent}</div>
                <div class="chat-msg-time">${timeStr}</div>
            </div>
        `;
        feed.appendChild(bubbleWrapper);
    });
    
    // Rola para o final do feed
    feed.scrollTop = feed.scrollHeight;
}

// Captura arquivo anexado e converte para base64 para envio
function handleChatFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Limite de 5MB
    if (file.size > 5 * 1024 * 1024) {
        alert("O limite de tamanho de arquivos é 5MB.");
        event.target.value = "";
        return;
    }
    
    chatSelectedFileName = file.name;
    const ext = file.name.split('.').pop().toLowerCase();
    chatSelectedFileType = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? 'image' : 'document';
    
    const reader = new FileReader();
    reader.onload = function(e) {
        chatSelectedFileBase64 = e.target.result;
        
        // Exibe preview
        const preview = document.getElementById("chatAttachPreview");
        const nameEl = document.getElementById("chatAttachName");
        if (preview && nameEl) {
            nameEl.textContent = `${file.name} (${chatSelectedFileType === 'image' ? 'Imagem' : 'Documento'})`;
            preview.style.display = "flex";
        }
    };
    reader.readAsDataURL(file);
}

// Remove anexo
function clearChatAttach() {
    chatSelectedFileBase64 = null;
    chatSelectedFileName = null;
    chatSelectedFileType = null;
    
    const fileInput = document.getElementById("chatFileInput");
    if (fileInput) fileInput.value = "";
    
    const preview = document.getElementById("chatAttachPreview");
    if (preview) preview.style.display = "none";
}

// Envia mensagem pelo socket
function sendChatMessage() {
    if (!chatSocket || chatSocket.readyState !== 1) {
        alert("Erro de conexão! Tentando reconectar ao chat...");
        return;
    }
    
    const input = document.getElementById("chatMessageInput");
    if (!input) return;
    
    const text = input.value.trim();
    
    if (!text && !chatSelectedFileBase64) {
        return;
    }
    
    // Cria objeto da mensagem
    const payload = {
        type: 'message',
        target: chatActiveTarget, // 'geral' ou matrícula do colaborador
        text: text,
        mediaType: chatSelectedFileType,
        mediaName: chatSelectedFileName,
        mediaData: chatSelectedFileBase64
    };
    
    chatSocket.send(JSON.stringify(payload));
    
    // Limpa campos
    input.value = "";
    clearChatAttach();
}

function handleChatKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage();
    }
}

// ==========================================================================
// PAINEL DE MODERAÇÃO E MONITOR DO GESTOR
// ==========================================================================

let gestorModerationAlerts = [];

// Carrega alertas de moderação antigos salvos no banco do servidor
async function loadGestorModerationAlerts() {
    if (!currentLoggedUser || currentLoggedUser.role !== 'gestor') return;
    
    try {
        const res = await fetch(`${apiBase}/api/chat-alerts/${currentLoggedUser.fk_empresa}`);
        if (res.ok) {
            gestorModerationAlerts = await res.json();
            renderGestorModerationAlerts();
            updateGestorModBadge();
        }
    } catch (e) {
        console.error("Erro ao carregar alertas de moderação:", e);
    }
}

// Trata o recebimento de um novo alerta de moderação via WebSocket
function handleIncomingModerationAlert(alert) {
    // Adiciona ao topo dos alertas
    gestorModerationAlerts.unshift(alert);
    
    // Limita a 50 alertas em memória local
    if (gestorModerationAlerts.length > 50) {
        gestorModerationAlerts = gestorModerationAlerts.slice(0, 50);
    }
    
    renderGestorModerationAlerts();
    updateGestorModBadge();
    
    // Efeito de pulso e som de alerta sonoro leve ou notificação na tela
    console.log("Alerta de Moderação recebido para o Gestor:", alert);
}

// Atualiza o contador de alertas no botão vermelho do gestor
function updateGestorModBadge() {
    const badge = document.getElementById("gestorModAlertBadge");
    const countEl = document.getElementById("gestorModAlertCount");
    
    if (badge && countEl) {
        const activeAlertsCount = gestorModerationAlerts.length;
        if (activeAlertsCount > 0) {
            countEl.textContent = activeAlertsCount;
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }
    }
}

// Limpa/Exclui a lista de alertas de moderação do gestor
async function clearGestorModerationAlerts() {
    if (!currentLoggedUser || currentLoggedUser.role !== 'gestor') return;
    
    if (confirm("Deseja marcar todos os alertas de moderação como resolvidos/lidos?")) {
        try {
            const res = await fetch(`${apiBase}/api/chat-alerts/${currentLoggedUser.fk_empresa}/read`, {
                method: 'POST'
            });
            if (res.ok) {
                gestorModerationAlerts = [];
                renderGestorModerationAlerts();
                updateGestorModBadge();
                alert("Alertas de moderação limpos com sucesso.");
            }
        } catch (e) {
            alert("Erro ao tentar limpar alertas.");
        }
    }
}

// Renderiza a lista de alertas de moderação no Monitor do Gestor
function renderGestorModerationAlerts() {
    const container = document.getElementById("gestorModerationAlerts");
    if (!container) return;
    
    container.innerHTML = "";
    
    if (gestorModerationAlerts.length === 0) {
        container.innerHTML = `
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; padding:10px 14px; border-radius:8px; font-size:0.8rem; font-weight:600; display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-circle-check"></i> Nenhum alerta de moderação pendente. Todas as conversas estão em conformidade com as regras de conduta.
            </div>
        `;
        return;
    }
    
    // Botão de resolver todos
    const headerRow = document.createElement("div");
    headerRow.style = "display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;";
    headerRow.innerHTML = `
        <span style="font-size:0.75rem; font-weight:700; color:#b91c1c;"><i class="fa-solid fa-triangle-exclamation"></i> Conteúdo suspeito detectado pelo filtro automático</span>
        <button class="btn btn-secondary btn-sm" onclick="clearGestorModerationAlerts()" style="font-size:0.75rem; padding:4px 10px;"><i class="fa-solid fa-circle-check"></i> Resolver / Limpar Alertas</button>
    `;
    container.appendChild(headerRow);
    
    gestorModerationAlerts.forEach(alert => {
        const dateObj = new Date(alert.timestamp);
        const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const item = document.createElement("div");
        item.className = "moderation-alert-item";
        
        const channelName = alert.target === 'geral' ? '📢 Canal Geral' : `🔒 Privada (DM para ${alert.target})`;
        
        item.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation"></i>
            <div style="flex:1;">
                <div><strong>${alert.autor.nome} (${alert.autor.matricula})</strong> em <u>${channelName}</u> às ${timeStr}:</div>
                <div style="background:white; border:1px solid #fee2e2; border-radius:6px; padding:6px 10px; margin:6px 0; font-family:monospace; font-size:0.85rem; color:#b91c1c;">"${alert.text}"</div>
                <div>Gatilho detectado: <strong style="text-transform:uppercase;">${alert.trigger}</strong></div>
            </div>
        `;
        container.appendChild(item);
    });
}

// Renderiza o visualizador em tempo real de mensagens públicas (Canal Geral) no Monitor do Gestor
function renderGestorChatFeed() {
    const feed = document.getElementById("gestorChatFeed");
    if (!feed) return;
    
    feed.innerHTML = "";
    
    const messages = chatMessagesByTarget['geral'] || [];
    
    if (messages.length === 0) {
        feed.innerHTML = `
            <div style="text-align:center; color:var(--text-muted); font-size:0.85rem; padding:20px;">
                <i class="fa-solid fa-comments" style="font-size:1.5rem; display:block; margin-bottom:8px; opacity:0.4;"></i>
                Nenhuma mensagem no Canal Geral da empresa ainda.
            </div>
        `;
        return;
    }
    
    messages.forEach(m => {
        const bubble = document.createElement("div");
        bubble.style = "background:white; border:1px solid var(--color-border); border-radius:10px; padding:10px 14px; display:flex; flex-direction:column; gap:4px; max-width:90%;";
        
        const dateObj = new Date(m.timestamp);
        const timeStr = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        let textContent = m.text || '';
        let mediaHtml = '';
        let flaggedHtml = m.flagged ? '<span style="background:#ef4444; color:white; font-size:0.6rem; font-weight:700; padding:2px 6px; border-radius:4px; margin-left:8px;"><i class="fa-solid fa-shield-halved"></i> MODERADO</span>' : '';
        
        if (m.mediaType) {
            mediaHtml = `<div style="font-size:0.75rem; color:var(--color-primary-light); font-weight:600;"><i class="fa-solid fa-paperclip"></i> Anexo: [${m.mediaType === 'image' ? 'Imagem' : 'Documento'}] - ${m.mediaName || ''}</div>`;
        }
        
        bubble.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.72rem; color:var(--text-light); border-bottom:1px dashed var(--color-border); padding-bottom:4px; margin-bottom:4px;">
                <strong>${m.autor.nome} (${m.autor.matricula})</strong>
                <span>${timeStr} ${flaggedHtml}</span>
            </div>
            ${mediaHtml}
            <div style="font-size:0.85rem; color:var(--text-main); word-break:break-all;">${textContent}</div>
        `;
        feed.appendChild(bubble);
    });
    
    feed.scrollTop = feed.scrollHeight;
}

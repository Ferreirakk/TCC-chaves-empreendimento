const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { WebSocketServer } = require('ws');
const qrcode = require('qrcode-terminal');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve os arquivos estáticos do site (HTML, CSS, JS, imagens)
app.use(express.static(path.join(__dirname)));

// Rota para obter os dados do banco
app.get('/api/db', (req, res) => {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (err) {
        console.error("Erro ao ler o arquivo db.json:", err);
        res.status(500).json({ error: "Erro interno do servidor ao ler os dados" });
    }
});

// Rota para obter o IP local do servidor e todas as interfaces ativas
app.get('/api/ip', (req, res) => {
    res.json({ 
        ip: getPreferredIP(),
        ips: getLocalIPs()
    });
});

// Rota para salvar os dados inteiros do banco
app.post('/api/db', (req, res) => {
    try {
        const data = req.body;
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
        res.json({ message: "Dados salvos com sucesso!" });
    } catch (err) {
        console.error("Erro ao salvar no arquivo db.json:", err);
        res.status(500).json({ error: "Erro interno do servidor ao salvar os dados" });
    }
});

// Rota para buscar mensagens de chat de uma empresa
app.get('/api/chat/:empresaId', (req, res) => {
    try {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.chats) db.chats = {};
        const messages = db.chats[req.params.empresaId] || [];
        res.json(messages);
    } catch (err) {
        res.status(500).json({ error: "Erro ao ler mensagens do chat." });
    }
});

// Rota para buscar alertas de moderação de um gestor
app.get('/api/chat-alerts/:empresaId', (req, res) => {
    try {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.chat_alerts) db.chat_alerts = {};
        const alerts = db.chat_alerts[req.params.empresaId] || [];
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: "Erro ao ler alertas de moderação." });
    }
});

// Rota para marcar alertas de moderação como lidos
app.post('/api/chat-alerts/:empresaId/read', (req, res) => {
    try {
        const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!db.chat_alerts) db.chat_alerts = {};
        db.chat_alerts[req.params.empresaId] = [];
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erro ao limpar alertas." });
    }
});

// ==========================================================================
// MODERAÇÃO DE CONTEÚDO (Filtro Lexical Robusto)
// ==========================================================================
const PALAVRAS_OFENSIVAS = [
    // Racismo
    'macaco', 'macacos', 'negão', 'negona', 'crioulo', 'crioula', 'escrava', 'escravo',
    // Homofobia
    'viado', 'viadinho', 'bichona', 'bicha', 'sapatão', 'boiola', 'veado', 'frango',
    // Misoginia
    'vadia', 'puta', 'vagabunda', 'piranha', 'galinha', 'feminazi',
    // Termos gerais
    'babaca', 'burro', 'idiota', 'imbecil', 'retardado', 'deficiente mental',
    // Palavrões de ódio
    'vsf', 'vai se fuder', 'vai tomar no', 'cuzão', 'canalha', 'racista', 'homofóbico'
];

function checkModeration(text) {
    if (!text) return { ok: true };
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const palavra of PALAVRAS_OFENSIVAS) {
        const normalizedPalavra = palavra.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (lower.includes(normalizedPalavra)) {
            return { ok: false, trigger: palavra };
        }
    }
    return { ok: true };
}

// ==========================================================================
// SERVIDOR HTTP + WEBSOCKET
// ==========================================================================
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Mapa de clientes WebSocket por empresa: { empresaId: Set<ws> }
const chatClients = new Map();

wss.on('connection', (ws) => {
    ws.empresaId = null;
    ws.userInfo = null;
    ws.isGestor = false;

    ws.on('message', (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch (e) {
            return;
        }

        switch (msg.type) {
            case 'join': {
                // Colaborador/Gestor informa em qual empresa está entrando
                ws.empresaId = msg.empresaId;
                ws.userInfo = msg.userInfo; // { nome, matricula }
                ws.isGestor = msg.isGestor || false;

                if (!chatClients.has(ws.empresaId)) {
                    chatClients.set(ws.empresaId, new Set());
                }
                chatClients.get(ws.empresaId).add(ws);

                // Envia histórico de mensagens ao usuário que acabou de entrar
                try {
                    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                    const history = (db.chats && db.chats[ws.empresaId]) ? db.chats[ws.empresaId] : [];
                    
                    // Filtra o histórico com base no papel (Gestor vs Colaborador) e destinatário (Geral vs DMs)
                    let filteredHistory = [];
                    const myMat = ws.userInfo.matricula;
                    if (ws.isGestor) {
                        // Gestor vê canal geral + DMs onde ele participa como remetente ou destinatário
                        filteredHistory = history.filter(m => {
                            const isGeral = m.target === 'geral' || !m.target;
                            const isMyDm = m.target === myMat || m.autor.matricula === myMat;
                            return isGeral || isMyDm;
                        });
                    } else {
                        // Colaborador vê o canal geral E as DMs onde participa
                        filteredHistory = history.filter(m => {
                            const isGeral = m.target === 'geral' || !m.target;
                            const isMyDm = m.target === myMat || m.autor.matricula === myMat;
                            return isGeral || isMyDm;
                        });
                    }
                    
                    ws.send(JSON.stringify({ type: 'history', messages: filteredHistory }));
                } catch (e) {
                    console.error('Erro ao enviar histórico do chat:', e);
                }
                break;
            }

            case 'message': {
                if (!ws.empresaId) break;
                
                const target = msg.target || 'geral';
                
                // Gestor só pode enviar DMs privadas, não pode enviar para o canal geral
                if (ws.isGestor && target === 'geral') break;
                
                const modResult = checkModeration(msg.text);
                const chatMsg = {
                    id: Date.now() + '_' + Math.random().toString(36).slice(2),
                    empresaId: ws.empresaId,
                    autor: ws.userInfo,
                    target: target,
                    text: msg.text || '',
                    mediaType: msg.mediaType || null,   // 'image' | 'pdf' | 'doc' | null
                    mediaName: msg.mediaName || null,
                    mediaData: msg.mediaData || null,   // Base64
                    flagged: !modResult.ok,
                    timestamp: new Date().toISOString()
                };

                // Persiste a mensagem no banco
                try {
                    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
                    if (!db.chats) db.chats = {};
                    if (!db.chats[ws.empresaId]) db.chats[ws.empresaId] = [];
                    
                    // Guarda sem mediaData para não estourar o banco em disco
                    const msgForDb = { ...chatMsg, mediaData: chatMsg.mediaData ? '[MEDIA]' : null };
                    db.chats[ws.empresaId].push(msgForDb);
                    
                    // Mantém histórico limitado a 500 mensagens
                    if (db.chats[ws.empresaId].length > 500) {
                        db.chats[ws.empresaId] = db.chats[ws.empresaId].slice(-500);
                    }

                    if (!modResult.ok) {
                        // Registra alerta de moderação
                        if (!db.chat_alerts) db.chat_alerts = {};
                        if (!db.chat_alerts[ws.empresaId]) db.chat_alerts[ws.empresaId] = [];
                        db.chat_alerts[ws.empresaId].push({
                            id: chatMsg.id,
                            autor: ws.userInfo,
                            target: target,
                            text: msg.text,
                            trigger: modResult.trigger,
                            timestamp: chatMsg.timestamp
                        });
                    }
                    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
                } catch (e) {
                    console.error('Erro ao persistir mensagem de chat:', e);
                }

                // Broadcast para os clientes elegíveis
                if (chatClients.has(ws.empresaId)) {
                    const payload = JSON.stringify({ type: 'message', message: chatMsg });
                    const senderMat = String(ws.userInfo.matricula).trim();
                    const targetMat = String(target).trim();
                    chatClients.get(ws.empresaId).forEach(client => {
                        if (client.readyState === 1) {
                            if (targetMat === 'geral') {
                                // Geral vai para todos os colaboradores e gestores da mesma empresa
                                client.send(payload);
                            } else {
                                // DM privada vai apenas para o remetente e destinatário
                                const clientMat = client.userInfo ? String(client.userInfo.matricula).trim() : '';
                                const isSender = clientMat === senderMat;
                                const isRecipient = clientMat === targetMat;
                                if (isSender || isRecipient) {
                                    client.send(payload);
                                }
                            }
                        }
                    });
                }

                // Alerta instantâneo de moderação para o gestor
                if (!modResult.ok && chatClients.has(ws.empresaId)) {
                    const alertPayload = JSON.stringify({
                        type: 'moderation_alert',
                        alert: {
                            id: chatMsg.id,
                            autor: ws.userInfo,
                            target: target,
                            text: msg.text,
                            trigger: modResult.trigger,
                            timestamp: chatMsg.timestamp
                        }
                    });
                    chatClients.get(ws.empresaId).forEach(client => {
                        if (client.isGestor && client.readyState === 1) {
                            client.send(alertPayload);
                        }
                    });
                }
                break;
            }
        }
    });

    ws.on('close', () => {
        if (ws.empresaId && chatClients.has(ws.empresaId)) {
            chatClients.get(ws.empresaId).delete(ws);
        }
    });
});

// ==========================================================================
// DETECÇÃO DE REDE
// ==========================================================================

// Obtém todas as interfaces de rede IPv4 ativas com nomes amigáveis
function getLocalIPs() {
    const ifaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                let displayName = name;
                let type = 'other';
                const lowerName = name.toLowerCase();
                
                // USB Tethering / Ancoragem USB
                if (lowerName.includes('ndis') || lowerName.includes('rndis') ||
                    lowerName.includes('tether') || lowerName.includes('ancoragem') ||
                    lowerName.includes('usb')) {
                    displayName = `Ancoragem USB (${name})`;
                    type = 'usb';
                }
                // Ethernet com USB tethering embutido
                else if ((lowerName.includes('ethernet') || lowerName.includes('cabo') ||
                    lowerName.includes('área local') || lowerName.includes('local area'))) {
                    if (iface.address.startsWith('192.168.42.') || iface.address.startsWith('192.168.49.') ||
                        iface.address.startsWith('192.168.43.') || iface.address.startsWith('172.20.10.')) {
                        displayName = `Ancoragem USB (${name})`;
                        type = 'usb';
                    } else {
                        displayName = `Rede Local/Cabo (${name})`;
                        type = 'ethernet';
                    }
                }
                // Wi-Fi - pode ser rede externa ou hotspot do celular
                else if (lowerName.includes('wi-fi') || lowerName.includes('wireless') ||
                    lowerName.includes('wlan') || lowerName.includes('sem fio')) {
                    // Subredes comuns de hotspot de celular
                    if (iface.address.startsWith('192.168.43.') || iface.address.startsWith('192.168.42.') ||
                        iface.address.startsWith('172.20.10.') || iface.address.startsWith('10.42.0.')) {
                        displayName = `Hotspot do Celular - Wi-Fi (${name})`;
                        type = 'hotspot';
                    } else {
                        displayName = `Rede Wi-Fi (${name})`;
                        type = 'wifi';
                    }
                }
                // Interfaces genéricas em subredes de hotspot
                else if (iface.address.startsWith('192.168.43.') || iface.address.startsWith('10.42.0.')) {
                    displayName = `Hotspot do Celular (${name})`;
                    type = 'hotspot';
                }
                
                ips.push({
                    name: displayName,
                    address: iface.address,
                    type
                });
            }
        }
    }
    return ips;
}

// Retorna a pontuação de prioridade para a conexão USB Tethering
function getTetheringScore(name, address) {
    let score = 0;
    const lowerName = name.toLowerCase();
    
    // Subredes típicas de ancoragem USB (Android/iOS)
    if (address.startsWith('192.168.42.')) score += 100;
    if (address.startsWith('192.168.49.')) score += 90;
    if (address.startsWith('192.168.43.')) score += 80;
    if (address.startsWith('172.20.10.')) score += 100;
    
    const parts = address.split('.').map(Number);
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
        score += 50;
    }
    
    if (lowerName.includes('ndis') || lowerName.includes('rndis') || lowerName.includes('tether') || lowerName.includes('ancoragem') || lowerName.includes('usb')) {
        score += 60;
    }
    
    return score;
}

// Seleciona o IP preferencial, priorizando conexões USB Tethering
function getPreferredIP() {
    const ips = getLocalIPs();
    if (ips.length === 0) return 'localhost';
    
    ips.sort((a, b) => {
        const scoreA = getTetheringScore(a.name, a.address);
        const scoreB = getTetheringScore(b.name, b.address);
        return scoreB - scoreA;
    });
    
    return ips[0].address;
}

// Mantido para compatibilidade simples caso outra parte chame
function getLocalIP() {
    return getPreferredIP();
}

server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    const preferredIP = getPreferredIP();
    const preferredUrl = `http://${preferredIP}:${PORT}/index.html`;
    const adminUrl = `http://${preferredIP}:${PORT}/chaves_admin.html`;

    console.log('\n====================================================================');
    console.log('      CHAVES TREINAMENTOS - Servidor Local');
    console.log('====================================================================');
    console.log('\n  Interfaces de rede ativas detectadas:');
    if (ips.length === 0) {
        console.log(`  - Localhost: http://localhost:${PORT}/index.html`);
    } else {
        ips.forEach(ipObj => {
            const isPref = ipObj.address === preferredIP ? ' [Preferencial]' : '';
            const typeLabel = ipObj.type === 'hotspot' ? '  📶 HOTSPOT' :
                              ipObj.type === 'usb'     ? '  🔌 USB' :
                              ipObj.type === 'wifi'    ? '  📡 Wi-Fi' : '';
            console.log(`  - ${ipObj.name}${typeLabel}: http://${ipObj.address}:${PORT}/index.html${isPref}`);
        });
    }
    console.log(`\n  Painel Admin   : ${adminUrl}`);

    // Gera QR Code para CADA interface disponível
    const accessibleIPs = ips.filter(ip => ip.type === 'usb' || ip.type === 'hotspot' || ip.type === 'wifi');

    if (accessibleIPs.length > 0) {
        accessibleIPs.forEach(ipObj => {
            const url = `http://${ipObj.address}:${PORT}/index.html`;
            const label = ipObj.type === 'hotspot' ? 'HOTSPOT DO CELULAR' :
                          ipObj.type === 'usb'     ? 'ANCORAGEM USB' : 'WI-FI';
            console.log(`\n--- QR CODE: ${label} (${ipObj.address}) ---\n`);
            qrcode.generate(url, { small: true });
        });
    } else {
        console.log('\n--- QR CODE DE ACESSO (acesse pelo celular) ---\n');
        qrcode.generate(preferredUrl, { small: true });
    }
    
    console.log(`\n  Escaneie o QR Code correspondente à sua conexão:`);
    console.log(`   🔌 Ancoragem USB: celular conectado por cabo USB ao PC`);
    console.log(`   📶 Hotspot: outros celulares conectados ao Wi-Fi do seu celular`);
    console.log(`   📡 Wi-Fi: dispositivos na mesma rede Wi-Fi`);
    console.log('\n====================================================================\n');
});


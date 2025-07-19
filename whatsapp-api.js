const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const crypto = require('crypto');

// Carrega variáveis de ambiente
dotenv.config();

// Configurações de segurança
const API_TOKEN = process.env.API_TOKEN || crypto.randomBytes(32).toString('hex');
const requestLog = {};

// Se o token foi gerado automaticamente, mostra para o usuário
if (!process.env.API_TOKEN) {
    console.log('?? Nenhum token API configurado no arquivo .env');
    console.log(`?? Token gerado automaticamente: ${API_TOKEN}`);
    console.log('?? Recomendamos adicionar este token ao seu arquivo .env como API_TOKEN');
}

// Função para encontrar o executável do Chrome
function findChrome() {
    // Seus caminhos específicos encontrados
    const possiblePaths = [
        '/usr/bin/google-chrome-stable',    // Prioridade 1 - Chrome estável
        '/usr/bin/google-chrome',           // Prioridade 2 - Chrome genérico
        '/usr/bin/chromium-browser',        // Prioridade 3 - Chromium browser
        '/snap/bin/chromium'                // Prioridade 4 - Chromium snap
    ];

    for (const chromePath of possiblePaths) {
        if (fs.existsSync(chromePath)) {
            console.log(`? Navegador encontrado em: ${chromePath}`);
            return chromePath;
        }
    }
    
    console.log('?? Nenhum navegador encontrado nos caminhos detectados');
    return null;
}

// Configuração do Puppeteer otimizada para seu sistema
const puppeteerConfig = {
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-web-security',
        '--disable-extensions'
    ],
    headless: true // Força modo headless para servidor
};

// Tenta encontrar o Chrome instalado
const chromePath = findChrome();
if (chromePath) {
    puppeteerConfig.executablePath = chromePath;
}

// Inicializa o cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: puppeteerConfig
});

// Evento de geração de QR Code
client.on('qr', (qr) => {
    console.log('?? QR Code gerado. Escaneie com seu WhatsApp:');
    qrcode.generate(qr, { small: true });
});

// Evento de autenticação
client.on('authenticated', () => {
    console.log('? Autenticado com sucesso!');
});

// Evento de pronto
client.on('ready', () => {
    console.log('?? Cliente WhatsApp está pronto e conectado!');
    startServer();
});

// Evento de desconexão
client.on('disconnected', (reason) => {
    console.log('?? Cliente desconectado:', reason);
});

// Inicializa o cliente
console.log('?? Inicializando cliente WhatsApp...');
client.initialize().catch(err => {
    console.error('? Erro ao inicializar o cliente WhatsApp:', err);
    console.log('?? Dicas para resolver:');
    console.log('1. Execute: npm install');
    console.log('2. Instale o Chrome: sudo apt-get install google-chrome-stable');
    console.log('3. Ou instale o Chromium: sudo apt-get install chromium-browser');
    process.exit(1);
});

// Função para verificar se a requisição vem do localhost
function isLocalRequest(req) {
    const ip = req.socket.remoteAddress;
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

// Função para verificar limite de requisições
function checkRateLimit(ip) {
    const now = Date.now();
    const minute = Math.floor(now / 60000);
    
    if (!requestLog[minute]) {
        // Limpa logs antigos para evitar vazamento de memória
        Object.keys(requestLog).forEach(key => {
            if (parseInt(key) < minute) {
                delete requestLog[key];
            }
        });
        requestLog[minute] = {};
    }
    
    requestLog[minute][ip] = (requestLog[minute][ip] || 0) + 1;
    return requestLog[minute][ip] <= MAX_REQUESTS_PER_MINUTE;
}

// Registra uma tentativa de acesso não autorizada
function logSecurityEvent(type, ip, details) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type,
        ip,
        details
    };
    
    console.error(`?? [SEGURANÇA] ${type} - IP: ${ip} - ${details}`);
    
    // Opcionalmente, salva em um arquivo de log
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    fs.appendFileSync(
        path.join(logDir, 'security.log'),
        JSON.stringify(logEntry) + '\n'
    );
}

// Função para processar as requisições da API
function startServer() {
    const server = http.createServer((req, res) => {
        const clientIp = req.socket.remoteAddress;
        
        // Verifica se a requisição é local
        if (!isLocalRequest(req)) {
            logSecurityEvent('ACESSO_REMOTO_BLOQUEADO', clientIp, 'Tentativa de acesso de IP não local');
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Acesso não autorizado' }));
            return;
        }
        
        if (req.method === 'POST') {
            // Verifica o token de autenticação
            const authToken = req.headers['x-api-token'] || '';
            if (authToken !== API_TOKEN) {
                logSecurityEvent('TOKEN_INVÁLIDO', clientIp, 'Token de API inválido ou ausente');
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Token de autenticação inválido' }));
                return;
            }
            
            // Verifica o tamanho máximo do corpo (1MB)
            let size = 0;
            const MAX_SIZE = 1 * 1024 * 1024; // 1MB
            let body = '';
            
            req.on('data', chunk => {
                size += chunk.length;
                if (size > MAX_SIZE) {
                    logSecurityEvent('TAMANHO_EXCEDIDO', clientIp, 'Corpo da requisição muito grande');
                    res.writeHead(413, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Corpo da requisição muito grande' }));
                    req.destroy();
                } else {
                    body += chunk.toString();
                }
            });
            
            req.on('end', async () => {
                if (size > MAX_SIZE) return; // Já foi rejeitado
                
                try {
                    // Sanitizar e validar JSON
                    let data;
                    try {
                        data = JSON.parse(body);
                    } catch (e) {
                        throw new Error('JSON inválido');
                    }
                    
                    console.log('?? Requisição recebida de localhost');
                    
                    // Valida os dados recebidos
                    if (!data.groupId) {
                        throw new Error('ID do grupo não fornecido');
                    }
                    
                    if (!data.message) {
                        throw new Error('Mensagem não fornecida');
                    }
                    
                    // Tipo 1: Checkpoint (com imagem)
                    // Tipo 2: Alertas (apenas texto)
                    if (!data.tipo || ![1, 2].includes(data.tipo)) {
                        throw new Error('Tipo de envio inválido (deve ser 1 para checkpoint ou 2 para alertas)');
                    }
                    
                    // Envia a mensagem
                    if (data.tipo === 1) { // Checkpoint (com imagem)
                        if (!data.imagePath) {
                            throw new Error('Caminho da imagem não fornecido para tipo checkpoint');
                        }
                        
                        // Verifica se a imagem existe
                        if (!fs.existsSync(data.imagePath)) {
                            throw new Error(`Imagem não encontrada: ${data.imagePath}`);
                        }
                        
                        // Envia a imagem com a mensagem
                        const media = MessageMedia.fromFilePath(data.imagePath);
                        await client.sendMessage(data.groupId, media, { caption: data.message });
                        console.log(`? Checkpoint enviado para ${data.groupId}`);
                    } else { // Alertas (apenas texto)
                        await client.sendMessage(data.groupId, data.message);
                        console.log(`? Alerta enviado para ${data.groupId}`);
                    }
                    
                    // Responde ao cliente
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: 'Mensagem enviada com sucesso', 
                        timestamp: new Date().toISOString() 
                    }));
                    
                } catch (error) {
                    console.error('?? Erro ao processar requisição:', error);
                    logSecurityEvent('ERRO_PROCESSAMENTO', clientIp, `Erro: ${error.message}`);
                    
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: false, 
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }));
                }
            });
        } else if (req.method === 'GET') {
            // Verifica o token para requisições GET de status também
            const authToken = req.headers['x-api-token'] || '';
            if (authToken !== API_TOKEN) {
                logSecurityEvent('TOKEN_INVÁLIDO_STATUS', clientIp, 'Token inválido em requisição de status');
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Token de autenticação inválido' }));
                return;
            }
            
            // Para requisições GET, retorna informação sobre o status
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true,
                status: 'online', 
                whatsapp: client.info ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString(),
                server: {
                    uptime: process.uptime(),
                    memoryUsage: process.memoryUsage().rss / 1024 / 1024 + ' MB'
                }
            }));
        } else {
            // Método não permitido
            logSecurityEvent('MÉTODO_NÃO_PERMITIDO', clientIp, `Método: ${req.method}`);
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: false, 
                error: 'Método não permitido' 
            }));
        }
    });
    
    // Adiciona cabeçalhos de segurança a todas as respostas
    server.on('request', (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
        res.setHeader('Server', 'WhatsApp API');
    });
    
    // Define a porta em que o servidor irá escutar (apenas em localhost)
    const PORT = process.env.API_PORT || 3241;
    const HOST = '127.0.0.1'; // Força o servidor a escutar apenas em localhost
    
    server.listen(PORT, HOST, () => {
        console.log(`?? API WhatsApp rodando em ${HOST}:${PORT} (apenas acesso local)`);
        console.log('?? Segurança: Verificação de tokens ativada');
        console.log('?? Limite de requisições: Desativado');
    });
}

// Captura erros não tratados
process.on('uncaughtException', (err) => {
    console.error('?? Erro não tratado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('?? Promessa rejeitada não tratada:', reason);
});
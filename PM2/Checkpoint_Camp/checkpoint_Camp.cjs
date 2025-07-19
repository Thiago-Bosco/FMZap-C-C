/**
 * APIs importadas para a execução do código
 */
require('module').globalPaths.push('../../node_modules');
const os = require('os');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const http = require('http');
const dotenv = require('dotenv');

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Configurações do Zabbix
 */
const nome_cliente = "MLGomes";
const ZABBIX_LOGIN_URL = process.env.ZABBIX_Camp_URL;
const URL_BASE = ZABBIX_LOGIN_URL.replace('/index.php', '');
const ZABBIX_DASHBOARD_URL = `${URL_BASE}/zabbix.php?show=3&name=&severities%5B4%5D=4&severities%5B5%5D=5&acknowledgement_status=0&inventory%5B0%5D%5Bfield%5D=type&inventory%5B0%5D%5Bvalue%5D=&evaltype=0&tags%5B0%5D%5Btag%5D=appvendor&tags%5B0%5D%5Boperator%5D=2&tags%5B0%5D%5Bvalue%5D=mssqlserver&show_tags=3&tag_name_format=0&tag_priority=&show_opdata=0&filter_name=&filter_show_counter=0&filter_custom_time=0&sort=host&sortorder=ASC&age_state=0&show_symptoms=0&show_suppressed=0&acknowledged_by_me=0&compact_view=0&show_timeline=0&details=0&highlight_row=0&action=problem.view`;
const USERNAME = process.env.ZABBIX_Camp_USERNAME;
const PASSWORD = process.env.ZABBIX_Camp_PASSWORD;
const Grupo_do_cliente = process.env.WHATSAPP_GRUPO_Camp;
const INTERNAL_GRUPO = process.env.WHATSAPP_GRUPO_CONTROLE;

const { existsSync } = require('fs');
let browserGC;
if (os.platform() === 'linux') {
    // Ordem de prioridade para Ubuntu/Linux
    const possiblePaths = [
        '/usr/bin/google-chrome-stable',  // Instalação via .deb oficial
        '/usr/bin/google-chrome',
        '/snap/bin/chromium',             // Snap package
        '/usr/bin/chromium-browser',      // Pacote Ubuntu
        '/usr/bin/chromium',
        '/opt/google/chrome/google-chrome', // Instalação manual
        '/usr/bin/google-chrome-unstable',
        '/usr/bin/google-chrome-beta'
    ];

    browserGC = possiblePaths.find(path => existsSync(path));

    if (!browserGC) {
        console.error('Navegador Chrome/Chromium não encontrado. Instale com um dos comandos:');
        console.error('  sudo apt install google-chrome-stable');
        console.error('  sudo apt install chromium-browser');
        console.error('  sudo snap install chromium');
        process.exit(1);
    }

    console.log(`?? Usando navegador: ${browserGC}`);
} else if (os.platform() === 'win32') {
    browserGC = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
} else {
    console.log('Sistema operacional não suportado.');
    process.exit(1);
}

async function startBrowser() {
    const launchOptions = {
        headless: true,
        executablePath: browserGC,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',        // Importante para ambientes com pouca memória compartilhada
            '--disable-gpu',                  // Desabilita GPU em ambiente headless
            '--window-size=1920,1080',
            '--disable-extensions',           // Desabilita extensões
            '--disable-plugins',              // Desabilita plugins
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows'
        ],
        defaultViewport: null
    };

    // Configurações específicas para Linux
    if (os.platform() === 'linux') {
        launchOptions.args.push(
            '--single-process',               // Usa processo único (útil em containers)
            '--no-zygote',                   // Desabilita zygote process
            '--disable-web-security'         // Pode ajudar com alguns sites
        );
    }

    return await puppeteer.launch(launchOptions);
}

/**
 * Função para enviar mensagem para a API WhatsApp
 */
async function enviarParaApi(data) {
    return new Promise((resolve, reject) => {
        const jsonData = JSON.stringify(data);

        // Obtém o token da API do arquivo .env
        const apiToken = process.env.API_TOKEN;

        const options = {
            hostname: 'localhost',
            port: 3241,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(jsonData),
                'X-API-Token': apiToken // Adiciona o token no cabeçalho
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(responseData);
                    if (response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error || 'Erro ao enviar mensagem'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(jsonData);
        req.end();
    });
}

/**
 * Função para envio de mensagens de texto (retorna promise para await)
 */
function enqueueMessage({ chatId, message }) {
    return enviarParaApi({
        groupId: chatId,
        message: message,
        tipo: 2
    })
        .then(() => console.log(`Mensagem enviada para ${chatId}`))
        .catch(err => console.error(`Erro ao enviar mensagem para ${chatId}:`, err));
}

/**
 * Função para enviar mensagem com imagem ao WhatsApp
 */
async function enviarMensagem(screenshotPath, captionMessage, tentativas = 3) {
    for (let i = 0; i < tentativas; i++) {
        try {
            // Verifica se o arquivo existe antes de tentar enviar
            if (!fs.existsSync(screenshotPath)) {
                throw new Error(`Arquivo de screenshot não encontrado: ${screenshotPath}`);
            }

            await enviarParaApi({
                groupId: Grupo_do_cliente,
                message: captionMessage,
                imagePath: screenshotPath,
                tipo: 1
            });
            console.log(`? Mensagem enviada para o grupo ${Grupo_do_cliente} com a legenda: ${captionMessage}`);
            return;
        } catch (error) {
            console.error(`?? Tentativa ${i+1} falhou:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    console.error("?? Todas as tentativas de envio falharam.");
}

/**
 * Função para enviar mensagem de texto ao WhatsApp
 */
async function enviarMensagemSemMedia(message, tentativas = 3) {
    for (let i = 0; i < tentativas; i++) {
        try {
            await enviarParaApi({
                groupId: Grupo_do_cliente,
                message: message,
                tipo: 2
            });
            console.log(`? Mensagem enviada para o grupo ${Grupo_do_cliente}: ${message}`);
            return;
        } catch (error) {
            console.error(`?? Tentativa ${i+1} falhou:`, error.message);
            const messageErro = "?? Ocorreu um erro ao enviar a mensagem. Verifique o sistema.";
            await enqueueMessage({ chatId: INTERNAL_GRUPO, message: messageErro });
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    console.error("?? Todas as tentativas de envio falharam.");
}

/**
 * Função para verificar a conexão com o Zabbix
 */
async function checkZabbixConnection() {
    console.log('?? Verificando conexão com o Zabbix...');
    let browser;
    try {
        browser = await startBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Timeout mais longo para conexões lentas
        await page.goto(ZABBIX_LOGIN_URL, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        await page.type('input[name="name"]', USERNAME);
        await page.type('input[name="password"]', PASSWORD);
        await Promise.all([
            page.click('#enter'),
            page.waitForNavigation({
                waitUntil: 'networkidle0',
                timeout: 60000
            })
        ]);
        console.log('? Conexão com o Zabbix bem-sucedida.');
        return true;
    } catch (error) {
        console.error('? Falha ao conectar ao Zabbix:', error.message);
        const message = "?? Houve problemas ao tentar conectar no Zabbix (Provável queda de VPN).\nCancelado a execução do script. Recomendado a análise do Analista";
        // Aguarda envio da mensagem antes de finalizar
        await enqueueMessage({ chatId: INTERNAL_GRUPO, message });
        console.log('?? Erro de conexão com o Zabbix detectado. Mensagem enviada. Encerrando execução.');
        process.exit(1);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * Função para realizar o checkpoint no Zabbix e enviar o print via WhatsApp
 */
async function checkpointZabbix() {
    const isConnected = await checkZabbixConnection();
    if (!isConnected) return;

    let browser;
    try {
        browser = await startBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        await page.goto(ZABBIX_LOGIN_URL, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        const dataAlerta = new Date().toLocaleTimeString('pt-br', {
            timeZone: "America/Sao_Paulo",
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        await page.type('input[name="name"]', USERNAME);
        await page.type('input[name="password"]', PASSWORD);
        await Promise.all([
            page.click('#enter'),
            page.waitForNavigation({
                waitUntil: 'networkidle0',
                timeout: 60000
            })
        ]);
        console.log(`? Login bem-sucedido às ${dataAlerta}`);

        await page.goto(ZABBIX_DASHBOARD_URL, {
            waitUntil: 'networkidle0',
            timeout: 60000
        });

        await page.evaluate(() => {
            document.body.style.zoom = "110%";
        });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const imgDir = path.join(__dirname, 'img');
        if (!fs.existsSync(imgDir)) {
            fs.mkdirSync(imgDir, { recursive: true }); // recursive: true garante criação de diretórios pai
        }

        const screenshotPath = path.join(imgDir, 'print_checkpoint_mlgomes.png');
        await page.screenshot({
            path: screenshotPath,
            clip: { x: 0, y: 0, width: 1920, height: 1080 }
        });
        console.log(`? Print salvo em ${screenshotPath}`);

        const horaExecucao = new Date().toLocaleTimeString('pt-br', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        const captionMessage = `Checkpoint ${horaExecucao} - Monitoramento MLGomes\n\nEquipe BOC`;

        await enviarMensagem(screenshotPath, captionMessage);

    } catch (error) {
        console.error("?? Erro durante o checkpoint do Zabbix:", error.message);
        const message = "?? Erro ao conectar no site do Zabbix da MLGomes. Verifique o sistema.";
        await enqueueMessage({ chatId: INTERNAL_GRUPO, message });
        console.error('?? Erro de execução detectado. Mensagem enviada e processo encerrado.');
    } finally {
        if (browser) {
            await browser.close();
        }
        console.log('?? Processo de print/checkpoint encerrado.');
    }
}

// Inicia o processo de checkpoint
console.log(`?? Iniciando o checkpoint da ${nome_cliente}...`);
checkpointZabbix()
    .then(() => {
        console.log('?? Checkpoint concluído.');
    })
    .catch(error => {
        console.error('?? Erro na execução do checkpoint:', error.message);
    });

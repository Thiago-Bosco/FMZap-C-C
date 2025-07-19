const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const util = require('util');

// Converter exec para Promise
const execPromise = util.promisify(exec);

async function clearPC() {
    console.log('🟢 Iniciando limpeza automática do PC...');
    
    try {
        await clearChrome();
        await clearTemp();
        await clearRecycleBin();
        console.log('🟢 Limpeza automática do PC concluída com sucesso!');
        console.log('🟢Atualizando o node e o puppeteer...');
        await updateNode();
        await updatePuppeteer();
        console.log('🟢 Atualizações concluídas com sucesso!');
    } catch (error) {
        console.error('🔴 Erro durante a limpeza:', error.message);
    }
}
async function updateNode() {
    console.log('🟡 Verificando a versão do Node.js');

    try {
        const currentVersion = process.version;
        console.log(`🟡 Versão atual do Node.js: ${currentVersion}`);

        console.log('🟡 Buscando atualizações para Node.js...');
        const { stdout } = await execPromise('npm view node version');
        // Remove aspas e espaços em branco, depois adiciona 'v'
        const latestVersion = `v${stdout.trim().replace(/['"]/g, '')}`;

        console.log(`🟡 Última versão disponível: ${latestVersion}`);

        if (currentVersion !== latestVersion) {
            console.log('🟡 Nova versão disponível, iniciando atualização...');
            
            if (process.platform === 'win32') {
                try {
                    await execPromise('nvm install latest && nvm use latest');
                    console.log('🟢 Node.js atualizado com sucesso via nvm!');
                } catch (nvmError) {
                    console.log('❗ nvm não encontrado, tentando atualizar via Chocolatey...');
                    try {
                        await execPromise('choco upgrade nodejs -y');
                        console.log('🟢 Node.js atualizado com sucesso via Chocolatey!');
                    } catch (chocoError) {
                        console.log('❗ Chocolatey não encontrado, tentando via npm...');
                        await execPromise('npm install -g npm@latest');
                        await execPromise('npm install -g node@latest');
                        console.log('🟢 Node.js atualizado com sucesso via npm!');
                    }
                }
            } else {
                try {
                    await execPromise('sudo n install latest');
                    console.log('🟢 Node.js atualizado com sucesso via n!');
                } catch (nError) {
                    console.log('❗ n não encontrado, tentando instalar...');
                    await execPromise('npm install -g n');
                    await execPromise('sudo n latest');
                    console.log('🟢 Node.js atualizado com sucesso!');
                }
            }

            const newVersion = execSync('node -v').toString().trim();
            console.log(`🟡 Versão atual do Node.js: ${newVersion}`);
        } else {
            console.log('🟢 Node.js já está na versão mais recente!');
        }
    } catch (error) {
        console.error('🔴 Erro ao atualizar o Node.js:', error.message);
    }
}
async function updatePuppeteer() {
    console.log('🟡 Verificando a versão do puppeteer...');
    try {
        const { stdout } = await execPromise('npm list puppeteer --depth=0');
        const versionMatch = stdout.match(/puppeteer@(\d+\.\d+\.\d+)/);
        
        if (!versionMatch) {
            console.log('🟡 Puppeteer não está instalado. Instalando...');
            await execPromise('npm install puppeteer@latest');
            console.log('🟢 Puppeteer instalado com sucesso!');
            return;
        }

        const currentVersion = versionMatch[1];
        console.log(`🟡 Versão atual do Puppeteer: ${currentVersion}`);

        console.log('🟡 Buscando atualizações para o Puppeteer...');
        const { stdout: latestVersion } = await execPromise('npm view puppeteer version');
        const latest = latestVersion.trim();

        if (currentVersion !== latest) {
            console.log(`🟡 Nova versão disponível: ${latest}`);
            console.log('🟡 Atualizando Puppeteer...');
            await execPromise('npm install puppeteer@latest --force');
            console.log('🟢 Puppeteer atualizado com sucesso!');
        } else {
            console.log('🟢 Puppeteer já está na versão mais recente!');
        }
    } catch (error) {
        console.error('🔴 Erro ao atualizar o Puppeteer:', error.message);
    }
}async function clearChrome() {
    console.log('🟡 Limpando cache do Chrome...');
    
    // Caminhos alternativos para o cache do Chrome
    const chromeCachePaths = [
        path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
        path.join(process.env.APPDATA, '..', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache')
    ];

    let cacheCleaned = false;
    
    for (const cachePath of chromeCachePaths) {
        if (fs.existsSync(cachePath)) {
            try {
                await fs.promises.rm(cachePath, { recursive: true, force: true });
                console.log(`✔️ Cache do Chrome limpo em: ${cachePath}`);
                cacheCleaned = true;
            } catch (error) {
                console.error(`🔴 Erro ao limpar cache em ${cachePath}:`, error.message);
            }
        }
    }
    
    if (!cacheCleaned) {
        console.log('⚠️ Nenhum cache do Chrome encontrado nos locais padrão');
    }
}

async function clearTemp() {
    console.log('🟡 Limpando arquivos temporários...');
    const tempPaths = [
        process.env.TEMP,
        path.join(process.env.SystemRoot || 'C:\\Windows', 'Temp')
    ];

    for (const tempPath of tempPaths) {
        if (fs.existsSync(tempPath)) {
            try {
                // Criar função de limpeza segura
                await cleanDirectory(tempPath);
                console.log(`✔️ Arquivos temporários limpos em: ${tempPath}`);
            } catch (error) {
                console.error(`🔴 Erro ao limpar temp em ${tempPath}:`, error.message);
            }
        }
    }
}

// Função segura para limpar diretórios
async function cleanDirectory(directory) {
    const files = await fs.promises.readdir(directory);
    
    for (const file of files) {
        const filePath = path.join(directory, file);
        try {
            const stat = await fs.promises.lstat(filePath);
            
            if (stat.isDirectory()) {
                await cleanDirectory(filePath);
                await fs.promises.rmdir(filePath).catch(() => {});
            } else {
                await fs.promises.unlink(filePath).catch(() => {});
            }
        } catch (error) {
            // Ignora arquivos/diretórios inacessíveis
            continue;
        }
    }
}

async function clearRecycleBin() {
    console.log('🟡 Limpando a lixeira...');
    
    try {
        // Método alternativo mais confiável para limpar a lixeira
        await execPromise('PowerShell.exe -Command "Clear-RecycleBin -Force"');
        console.log('✔️ Lixeira limpa com sucesso');
    } catch (error) {
        console.error('🔴 Erro ao limpar a lixeira:', error.message);
        console.log('⚠️ Tentando método alternativo...');
        
        // Método alternativo para limpar a lixeira
        try {
            await execPromise('rd /s /q C:\\$Recycle.Bin');
            console.log('✔️ Lixeira limpa usando método alternativo');
        } catch (altError) {
            console.error('🔴 Falha ao limpar a lixeira com ambos os métodos:', altError.message);
        }
    }
}



// Executar o script
clearPC();

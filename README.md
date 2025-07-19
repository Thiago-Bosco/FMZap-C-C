## FMZap - Sistema de Monitoramento Integrado

### 📋 Visão Geral

O **FMZap** é uma solução **automatizada** que captura informações em diferentes sistemas de monitoramento (Zabbix, AWS, etc.) e as envia via **WhatsApp**. Ideal para garantir o acompanhamento contínuo e proativo de eventos críticos, permitindo respostas ágeis a incidentes.

---

### 🎯 Funcionalidades Principais

1. **Alertas**

   * Notificações sobre problemas detectados.
   * Filtragem customizada para evitar ruídos.
2. **Checkpoints**

   * Capturas de tela periódicas dos dashboards.
   * Envio de imagens com contexto informativo.

Todas as notificações são direcionadas para grupos específicos no WhatsApp, assegurando que as equipes responsáveis sejam acionadas imediatamente.

---

### 🏗️ Arquitetura do Sistema

#### 1. API WhatsApp (`whatsapp-api.js`)

* Conexão persistente com o WhatsApp Web.
* Geração de QR Code para autenticação.
* Endpoints HTTP locais seguros (validação de tokens).

#### 2. Monitoramento de Alertas

* Conexão com múltiplas instâncias Zabbix.
* Extração e filtragem de novos alertas.
* Verificação de duplicidade via cache.
* Envio imediato de notificações.

#### 3. Captura de Checkpoints

* Automação de navegação em dashboards (Zabbix e AWS).
* Captura e envio de screenshots em intervalos programados.
* Registro detalhado de cada operação.

---

### ⚙️ Pré-requisitos

* **Node.js** >= v16.x
* **NPM**
* **PM2** (`npm install -g pm2`)

---

### 🚀 Instalação e Configuração

```bash
# 1. Clone o repositório
git clone https://github.com/Equipe-de-Qualidade/FMZap.git
cd fmzap

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais (Zabbix, AWS e IDs dos grupos WhatsApp)
```

---

### 🌛 Execução e Gerenciamento (PM2)

```bash
# Iniciar todos os serviços
pm2 start ecosystem.config.js

# Listar processos ativos
pm2 list

# Visualizar logs (individual ou global)
pm2 logs [id]  # ou  pm2 logs all
```

#### Agendamento de Tarefas

| Serviço                | Script                 | Frequência      | Descrição                                |
| ---------------------- | ---------------------- | --------------- | ---------------------------------------- |
| API WhatsApp           | `whatsapp-api.js`      | Contínuo        | Mantém conexão ativa                     |
| Alertas Instância A    | `checkalert_instA.cjs` | Minutos ímpares | Verifica alertas da instância A (Zabbix) |
| Alertas Instância B    | `checkalert_instB.cjs` | Minutos pares   | Verifica alertas da instância B (Zabbix) |
| Checkpoint Instância A | `checkpoint_instA.cjs` | A cada 2 horas  | Captura status da instância A            |
| Checkpoint Instância B | `checkpoint_instB.cjs` | A cada 4 horas  | Captura status da instância B            |
| Checkpoint Instância C | `checkpoint_instC.cjs` | A cada 2 horas  | Captura status da instância C (AWS)      |
| Limpeza de Caches      | scripts diversos       | Domingos        | Limpeza de caches                        |

---

### 🛠️ Comandos Adicionais

* `pm2 restart [id]` : Reinicia processo específico
* `pm2 stop [id]`    : Pausa processo
* `pm2 delete [id]`  : Remove processo
* `pm2 monit`        : Painel de monitoramento
* `pm2 save`         : Salva configuração atual
* `pm2 startup`      : Habilita PM2 na inicialização do sistema

---

### 🛡️ Tecnologias Utilizadas

* **Node.js**
* **whatsapp-web.js** (v1.23.0)
* **puppeteer** (v24.4.0)
* **qrcode-terminal** (v0.12.0)
* **dotenv** (v16.3.1)
* **PM2** (v5.4.3)

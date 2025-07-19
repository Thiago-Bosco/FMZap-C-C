# FMZap

Essa é a versão 2.0 dos bots de envio de mensagem, nomeado de FMZap, ele permite gerenciar vários botes através de uma unica execução do usuário, nesse documento, vamos mostrar como fazer para executar os bots.

## Tutorial de execução

O script atual é gerenciado pelo PM2 (Process Manager 2), um gerenciador de execuções em nodejs, ele executa um único arquivo que controla dos os scripts e seus tempos de execução, para começar, abra o CMD como administrador para ter certeza que não terá erros na execução, nele, cole esse comando abaixo

1. cd C:\Users\soc\Docments\GitHub\FMZap

Após isso, começaremos a executar o pm2 para isso, vamos precisar entender o básico do arquivo ecosystem.config.js, nele estão todos dados para executar os bots, então temos quais arquivos e quando serão executados. Então, para ele será iniciado usando o comando abaixo:

2. pm2 start ecosystem.config.js

Dessa forma, ele irá listar e mostrar os status de todos os scripts que serão executados, como no exemplo abaixo
![start_ecosystem](img/Status_ecosystem.png)
Após isso, pause todos eles para que a fila seja reiniciada na ordem certa.

3. pm2 stop all

Ao pausar, todos os scripts ficaram em vermelho e isso é normal, eles só estarão como ativos em seus momentos de execução para evitar que um atrapalhe o outro ou que o computador fique sobrecarregado.

![stop_all](img/stop_all.png)

## Pontos importantes

É sempre bom estar de olho na execução dos scripts nos primeiros minutos para verificar se tudo está correndo bem, para isso use o comando 

* pm2 log all

Uma tela parecida com essa ![log_all](img/log_all.png) irá aparecer, caso seja necessário autentificar o whatsapp via QRCode ou erros que estejam impedindo a execução, acione o Guilherme via whatsapp 97962-9580. Caso não acha erros, os logs deverão aparecer da seguinte forma. ![Execução_Ok](img/execução_ok.png).

Caso seja necessário parar uma execução por tempo indeterminado, podemos usar o seguinte comando para remover da fila

pm2 delete <Nome_da_execução>

Quando for possivel executar o script de novo coloque o comando

pm2 start ecosystem.config.js --only <Nome_da_execução>

### Nome de todas as execuções e suas funções
alert_UP (Esse é o script que envia os alertas da UP)
checkpoint_UP (Esse é o script que envia os checkpoints da UP)
checkpoint_Nippo (Esse é o script que envia os checkpoints da NippoKar)
checkpoint_Libbs (Esse é o script que envia os checkpoints da Libbs)
clear_UP (Esse é o script limpa o cache da UP)
clear_Nippo (Esse é o script limpa o cache da NippoKar)
alert_Nippo (Esse é o script que envia os alertas da NippoKar)

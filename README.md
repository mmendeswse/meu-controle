# Meu Controle — Vida & Fitness

Sistema pessoal de alimentação, compras, gastos com comida, treinos,
evolução do peso, sono, humor, hábitos, remédios e jejum — 100% local, sem servidor, sem cadastro e sem
mensalidade. Feito com HTML5, CSS3 e JavaScript puro (mais o Chart.js,
incluído no projeto para funcionar offline).

É o irmão do sistema de finanças: mesma estrutura de pastas, mesmo visual
(painel escuro, ciano como cor de marca, KPIs com anel de progresso) e a
mesma ideia de que **tudo que pode ser calculado é calculado**, nunca
digitado.

## Como usar

**No computador:** abra o arquivo `index.html` no navegador (duplo clique).
Não precisa instalar nada nem ter internet.

**Na web (GitHub Pages):** depois de subir este repositório para o GitHub,
vá em **Settings → Pages → Build and deployment → Source: Deploy from a
branch → Branch: `main` / `(root)` → Save**. Em um ou dois minutos o
sistema fica disponível em:

```
https://<seu-usuario>.github.io/<nome-do-repositorio>/
```

## Instalar como app (PC, celular e tablet)

O Meu Controle é um **PWA**: instalado, ele ganha ícone próprio, abre em
tela cheia, funciona sem internet e se atualiza sozinho. Abra o endereço do
GitHub Pages e:

| Aparelho | Como instalar |
| --- | --- |
| **PC (Chrome ou Edge)** | botão **Instalar app** na barra lateral (ou o ícone de instalar no fim da barra de endereço) |
| **Android (Chrome)** | **Mais → Instalar app** (ou menu ⋮ → Instalar app) |
| **iPhone / iPad (Safari)** | **Mais → Instalar app** mostra o passo a passo: **Compartilhar → Adicionar à Tela de Início** |
| **Mac (Safari)** | **Arquivo → Adicionar ao Dock** |

O cartão **Ajustes → Instalar o app** mostra se o app já está instalado e o
caminho para cada navegador. Segurando o ícone do app instalado (ou clicando
com o botão direito no PC) aparecem os **atalhos**: Hoje, Registrar peso,
Registrar refeição e Lista de compras.

> **Atenção no iPhone/iPad:** o app instalado guarda os dados separado do
> Safari e começa vazio. Se você já usava pelo Safari, faça **Ajustes → Fazer
> backup** antes e **Restaurar backup** dentro do app. No PC e no Android o
> app instalado usa os mesmos dados do navegador.

Para atualizar na hora (pegar uma versão nova publicada), no iPhone/iPad
**segure e puxe para baixo** no topo de qualquer tela: aparece a seta
circular; solte quando ela ficar ciano. No PC, basta fechar e abrir o app.

Na primeira vez que você abrir, o sistema começa **vazio**, com um passo a passo
de boas-vindas. Se quiser conhecer antes, use **Explorar com dados de exemplo**
(dados fictícios, marcados com um aviso amarelo e removíveis com um clique).

## Onde ficam os seus dados

Tudo é salvo no armazenamento local do seu próprio navegador
(`localStorage`). Nada é enviado para nenhum servidor. Isso quer dizer:

- Os dados ficam ligados àquele navegador, naquele aparelho. Outro
  navegador ou outro aparelho começa vazio.
- Limpar os dados de navegação apaga os seus dados.
- Para levar seus dados para outro lugar (ou ter uma cópia de segurança),
  use **Ajustes → Fazer backup** (arquivo `.json`) ou **Copiar como texto**
  (texto), e depois **Restaurar backup / Colar texto de backup** no outro aparelho.

## O que o sistema faz

Tudo conversa entre si — esse é o diferencial:

```
planejar refeição ─► soma o que vai ser consumido ─► confere o estoque
      │                                                  │ falta?
      │                                                  ▼
      │                                   entra sozinho na lista de compras
      │                                                  │ marcado como comprado
      ▼                                                  ▼
marcar como realizada ─► calorias/macros do dia      soma ao estoque
      │                  └─► Hoje, metas, insights e relatórios     
      └─► desconta do estoque (e devolve se desmarcar)
```

O menu segue a ordem do dia (o mesmo vale para o botão **+**):

1. **Hoje**: o **roteiro do dia em ordem de horário** (peso ao acordar →
   café → lanche → almoço → treino → jantar, e água ao longo do dia), com o
   próximo item em destaque e um toque para marcar como feito. Também mostra
   os números do dia/semana/mês, os insights e o progresso (primeiro → atual
   → meta, com o gráfico do peso). Na primeira vez, um passo a passo
   numerado: perfil → peso → metas → alimentos → ficha de treino.
2. **Corpo**: peso, massa muscular, gordura, água corporal, IMC e medidas,
   nada obrigatório. Comparação primeira → atual → meta com 🟢🟡🔴 calculado
   pela **tendência** (regressão linear), gráficos por período e histórico.
3. **Alimentação**, em três abas: **Diário** (calorias, macros, fibras e
   água × metas; marcar ✓ entra nas calorias e baixa o estoque), **Semana**
   (cardápio SEG → DOM, copiar dia, favoritas e "Compras para o cardápio") e
   **Alimentos** (cadastro com nutrição, preço, marca e categoria).
4. **Treino**, em quatro abas: **Treinos** (hoje, próximos 7 dias,
   histórico, frequência e sequências), **Fichas e plano** (as fichas e o
   plano da semana), **Calendário** (o mês) e **Carga** (evolução por
   exercício, recorde e 1RM estimado). Registro de séries/repetições/carga/RPE
   com "última vez".
5. **Bem-estar**, em quatro abas: **Resumo** (check-in de sono, humor,
   energia, estresse, passos e sintomas; gráficos de sono e humor,
   calendário do humor e "o que influencia o seu bem-estar", comparando
   sono × energia, treino × humor, água × disposição…), **Hábitos** (sim/não
   ou quantidade com meta, dias da semana, horário, sequência 🔥, mapa dos
   últimos 28 dias e **desafios** com duração — há 10 desafios prontos),
   **Remédios** (remédios, vitaminas e suplementos com dose, horários,
   frequência, estoque que desconta a cada dose, adesão e "pôr na lista de
   compras" quando estiver acabando) e **Jejum** (protocolos 12:12 a 24 h,
   contador ao vivo, estatísticas e histórico).
6. **Compras**, em três abas: **Lista mensal** (barra com ano + JAN…DEZ +
   Novo; cada mês tem sua lista e cada item tem a situação **Falta comprar /
   Já tenho / Comprado**, com totais no topo que também filtram; "Copiar mês
   anterior", aviso de pendentes de meses passados com "Trazer para este
   mês" e itens automáticos), **Em casa** (estoque, mínimo, validade e
   alertas) e **Gastos** (pela mesma barra do mês, por categoria e mercado, extrato e
   histórico de preços).
7. **Metas** e **Conquistas**: metas avaliadas pela tendência (agora também
   sono, passos e minutos ativos) e 35 medalhas calculadas pelos registros,
   com o quanto falta para as próximas e opção de compartilhar com a família.
8. **Relatórios**: diário, semanal, mensal e trimestral comparando com o
   período anterior; exportação em **PDF**, **CSV** e **Excel**; e, no fim,
   todos os insights.
9. **Ajustes**: **Aparência** (avatar com emoji e cor, tema escuro, claro ou
   automático, cor do app, mesma cor em todas as telas, tamanho da letra,
   vibração, animações e tamanho do copo de água), **Rotina do dia**
   (horários de acordar, refeições, treino, check-in e dormir; quais
   refeições aparecem; pesagem diária, semanal ou nenhuma; o que entra no
   roteiro "Seu dia"), **Lembretes**, perfil, integração, alertas,
   backup/restauração, exportação completa em Excel, exclusão parcial e reset
   completo (sempre com confirmação; o reset exige digitar APAGAR).

O roteiro **Seu dia** (tela Hoje) junta tudo na ordem dos horários da sua
rotina: sono, peso, refeições, cada dose de remédio, hábitos, treino, "como
foi o dia", água e o jejum em andamento.

## Lembretes

- **Notificações** (Ajustes → Lembretes): remédios, hábitos com horário,
  check-in e água. Aparecem enquanto o app está aberto ou minimizado — um
  app sem servidor não consegue acordar o celular sozinho. No iPhone/iPad,
  só funcionam com o app instalado.
- **Calendário** (Bem-estar → Remédios → Pôr no calendário, ou Ajustes):
  gera um arquivo `.ics` com os horários dos remédios e hábitos, com alarme.
  Aberto no celular, entra no app de calendário e avisa mesmo com o Meu
  Controle fechado.

## Para a família

Cada pessoa instala no próprio aparelho e personaliza do seu jeito (avatar,
cor, tema, letra, rotina, o que aparece no dia). Os dados de cada um ficam
no seu aparelho. As conquistas podem ser compartilhadas no grupo da família.

Os **alertas** (treino não feito, peso sem registro, estoque baixo, meta
atrasada, água e proteína abaixo da meta, backup antigo…) ficam no sino, e
cada tipo pode ser ligado/desligado em Ajustes.

Sem dados suficientes, as telas dizem **"Sem dados suficientes"** em vez de
estimar — nada é inventado.

## Limitações desta versão (de propósito)

- **Sem sincronização entre aparelhos.** Os dados moram no navegador. Use
  o backup para mover dados entre aparelhos.
- **Sem login.** É um arquivo local, não um serviço — qualquer pessoa com
  acesso ao aparelho e ao navegador vê os dados.
- **IMC é informativo.** Não substitui avaliação de nutricionista,
  educador físico ou médico.

## Estrutura do projeto

```
meu-controle/
├── index.html               # estrutura da página (menu, botão +, modal)
├── sw.js                    # funciona offline depois de publicado
├── css/style.css            # tema visual (base)
├── css/saude.css            # visual de app de saúde
├── css/extras.css           # telas novas e tema claro
└── js/
    ├── nucleo.js            # datas, unidades (g↔kg, ml↔L, un↔dz), estatística, listas fixas
    ├── armazenamento.js     # salvar/carregar, esquema v2, migração da v1, backup
    ├── demo.js              # dados de exemplo (só quando pedidos)
    ├── alimentacao.js       # alimentos, nutrição, refeições, água, favoritas, planejamento
    ├── compras.js           # lista, gastos, estoque e a integração entre eles
    ├── fitness.js           # peso, composição, medidas, fichas, treinos, calendário, cargas
    ├── bemestar.js          # check-in, hábitos, remédios e jejum (regras)
    ├── metas.js             # metas e avaliação por tendência
    ├── conquistas.js        # medalhas calculadas pelos registros
    ├── insights.js          # insights e alertas
    ├── relatorios.js        # relatórios + exportação CSV / XLSX / PDF
    ├── graficos.js          # todos os gráficos (Chart.js)
    ├── ui.js                # componentes de interface (cards, KPIs, modal, dicas…)
    ├── app.js               # rotas, menu, botão +, notificações, delegação de eventos
    ├── instalar.js          # botão Instalar app, guia do iPhone e atalhos do ícone
    ├── personalizar.js      # aparência e rotina do dia
    ├── lembretes.js         # notificações e calendário (.ics)
    ├── formularios.js       # formulários (modais)
    ├── formularios-saude.js # check-in, hábitos, remédios e jejum
    ├── paginas/             # uma página por arquivo (dashboard = Hoje, evolucao = Corpo, academia = Treino, …)
    └── vendor/chart.umd.min.js
```

Os módulos de regra (`alimentacao`, `compras`, `fitness`, `metas`,
`insights`, `relatorios`) não tocam no DOM: recebem o objeto de dados e
devolvem números. Cada página se registra com `App.registrarPagina(...)` —
para criar uma tela nova basta um arquivo em `js/paginas/`.

## Modelo de dados (versão 2)

Uma única chave no `localStorage` (`meuControle:v1`, campo `versao: 2`).
Dados da versão 1 são convertidos automaticamente na primeira abertura, e
uma cópia do original fica guardada em `meuControle:v1:antes-da-v2`.

| Coleção         | Entidade           | O que guarda                                           |
| --------------- | ------------------ | ------------------------------------------------------ |
| `usuarios`      | users              | perfil único: nome, altura, objetivo, início           |
| `alimentos`     | foods              | nutrição por porção, preço, marca, categoria           |
| `refeicoes`     | meals              | data, tipo, horário, status (Planejada/Realizada/Pulada) |
| `refeicaoItens` | meal_items         | refeição → alimento + quantidade                       |
| `favoritas`     | —                  | refeições modelo                                       |
| `agua`          | —                  | registros de água (ml)                                 |
| `compras`       | shopping_items     | lista mensal (`mes`) e compras feitas (estimado, pago…) |
| `estoque`       | inventory          | alimento → quantidade em casa, mínimo, validade        |
| `fichas`        | —                  | fichas de treino                                       |
| `exercicios`    | exercises          | exercícios de cada ficha (séries, faixa de reps)       |
| `treinos`       | workouts           | sessão por data (Planejado/Realizado/Cancelado)        |
| `series`        | workout_sets       | séries, repetições, carga, RPE de cada exercício       |
| `planoSemanal`  | —                  | dia da semana → ficha ou descanso                      |
| `pesagens`      | weight_records     | data + peso                                            |
| `medidas`       | body_measurements  | composição corporal e medidas                          |
| `metas`         | goals              | tipo, inicial, alvo, prazo                             |
| `bemEstar`      | —                  | check-in do dia: sono, humor, energia, estresse, passos |
| `habitos`       | —                  | hábitos e desafios (tipo, meta, dias, horário, duração) |
| `habitoRegistros` | —                | marcações (hábito + data + valor)                      |
| `remedios`      | —                  | dose, frequência, horários, período, estoque           |
| `doses`         | —                  | dose do dia: tomado / pulado (e doses extras)          |
| `jejuns`        | —                  | início, fim e meta em horas                            |
| `notificacoes`  | notifications      | quais alertas já foram vistos                          |
| `config`        | settings           | alertas, integração, backup, aparência, rotina, lembretes |

Relações por id, sem copiar dados. Peso atual, IMC, calorias do dia, gastos,
frequência, sequências, progresso de metas etc. são sempre **calculados**.

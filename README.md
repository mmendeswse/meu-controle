# Meu Controle — Vida & Fitness

Sistema pessoal de alimentação, compras, gastos com comida, treinos e
evolução do peso — 100% local, sem servidor, sem cadastro e sem
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

No celular ou iPad, abra esse endereço e use **Compartilhar → Adicionar à
Tela de Início**: ele vira um app, abre em tela cheia e funciona offline.

Na primeira vez que você abrir, o sistema começa **vazio**, com um passo a passo
de boas-vindas. Se quiser conhecer antes, use **Explorar com dados de exemplo**
(dados fictícios, marcados com um aviso amarelo e removíveis com um clique).

## Onde ficam os seus dados

Tudo é salvo no armazenamento local do seu próprio navegador
(`localStorage`). Nada é enviado para nenhum servidor. Isso quer dizer:

- Os dados ficam ligados àquele navegador, naquele aparelho. Outro
  navegador ou outro aparelho começa com os dados de demonstração.
- Limpar os dados de navegação apaga os seus dados.
- Para levar seus dados para outro lugar (ou ter uma cópia de segurança),
  use **Ajustes → Exportar backup** (arquivo `.json`) ou **Copiar backup**
  (texto), e depois **Importar / Colar backup** no outro aparelho.

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
      │                  └─► Dashboard, metas, insights e relatórios
      └─► desconta do estoque (e devolve se desmarcar)
```

- **Dashboard ("Como estou hoje?")** — resumo de hoje em checklist (café,
  almoço, lanche, jantar, água, treino, peso), seu progresso (primeiro →
  atual → meta), insights, painéis de Saúde, Alimentação, Academia e Compras,
  gráfico de peso e metas.
- **Alimentação** — diário com calorias, proteína, carboidratos, gorduras,
  fibras e água × metas; refeições montadas com alimentos cadastrados
  (nutrição calculada sozinha); cadastro de alimentos com nutrição, preço,
  marca e categoria.
- **Refeições** — planejador semanal SEG → DOM, copiar um dia para outros,
  refeições favoritas ("Almoço padrão") e "Compras para o planejado".
- **Compras** — lista com produto, quantidade, preço estimado e pago,
  mercado, categoria, prioridade, data e status (Pendente / Comprado /
  Cancelado), marcar como comprado direto na lista, itens automáticos;
  abas de Gastos (mês a mês, por categoria e mercado) e Histórico de preços.
- **Estoque** — o que há em casa, estoque mínimo, validade, alertas de
  estoque baixo e "+ Adicionar à lista de compras".
- **Academia** — fichas de treino, registro de séries/repetições/carga/RPE
  por exercício (com "última vez"), calendário mensal e plano semanal
  (planejado/realizado/cancelado), frequência, sequência atual e melhor
  sequência, evolução de carga por exercício e por semana.
- **Evolução** — peso, massa muscular, gordura, massa de gordura, água
  corporal, IMC e medidas (pescoço, peito, cintura, abdômen, quadril,
  braços, coxas), nada obrigatório; comparação primeira → atual → meta
  com 🟢🟡🔴 calculado pela **tendência** (regressão linear) e gráficos por
  período (7 dias a tudo).
- **Metas** — peso, massa muscular, gordura, cintura, treinos por semana,
  calorias, proteína, carboidratos, gorduras, fibras, água, gastos e
  orçamento da lista, com atual, objetivo, prazo e % concluído.
- **Relatórios** — diário, semanal, mensal e trimestral, comparando com o
  período anterior; exportação em **PDF** (impressão), **CSV** e **Excel**.
  Aba **Insights**: observações geradas só a partir dos seus registros.
- **Alertas** — treino não realizado, peso sem registro, estoque baixo,
  item importante pendente, meta atrasada, refeição planejada, água e
  proteína abaixo da meta, mudanças relevantes e backup antigo; cada tipo
  pode ser ligado/desligado.
- **Botão "+"** — registrar peso, refeição, água, treino, alimento, compra
  ou medidas de qualquer tela.
- **Configurações** — perfil, alertas, integração, backup/restauração,
  exportação completa em Excel, exclusão parcial de dados e reset completo
  (sempre com confirmação; o reset exige digitar APAGAR).

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
├── css/style.css            # tema visual
└── js/
    ├── nucleo.js            # datas, unidades (g↔kg, ml↔L, un↔dz), estatística, listas fixas
    ├── armazenamento.js     # salvar/carregar, esquema v2, migração da v1, backup
    ├── demo.js              # dados de exemplo (só quando pedidos)
    ├── alimentacao.js       # alimentos, nutrição, refeições, água, favoritas, planejamento
    ├── compras.js           # lista, gastos, estoque e a integração entre eles
    ├── fitness.js           # peso, composição, medidas, fichas, treinos, calendário, cargas
    ├── metas.js             # metas e avaliação por tendência
    ├── insights.js          # insights e alertas
    ├── relatorios.js        # relatórios + exportação CSV / XLSX / PDF
    ├── graficos.js          # todos os gráficos (Chart.js)
    ├── ui.js                # componentes de interface (cards, KPIs, modal, dicas…)
    ├── app.js               # rotas, menu, botão +, notificações, delegação de eventos
    ├── formularios.js       # todos os formulários (modais)
    ├── paginas/             # uma página por arquivo (dashboard, alimentacao, …)
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
| `compras`       | shopping_items     | lista e compras feitas (estimado, pago, status…)       |
| `estoque`       | inventory          | alimento → quantidade em casa, mínimo, validade        |
| `fichas`        | —                  | fichas de treino                                       |
| `exercicios`    | exercises          | exercícios de cada ficha (séries, faixa de reps)       |
| `treinos`       | workouts           | sessão por data (Planejado/Realizado/Cancelado)        |
| `series`        | workout_sets       | séries, repetições, carga, RPE de cada exercício       |
| `planoSemanal`  | —                  | dia da semana → ficha ou descanso                      |
| `pesagens`      | weight_records     | data + peso                                            |
| `medidas`       | body_measurements  | composição corporal e medidas                          |
| `metas`         | goals              | tipo, inicial, alvo, prazo                             |
| `notificacoes`  | notifications      | quais alertas já foram vistos                          |
| `config`        | settings           | alertas ligados, integração, backup                    |

Relações por id, sem copiar dados. Peso atual, IMC, calorias do dia, gastos,
frequência, sequências, progresso de metas etc. são sempre **calculados**.

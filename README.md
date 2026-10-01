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

Na primeira vez que você abrir, o sistema carrega dois perfis de
demonstração (**Ana (exemplo)** e **João (exemplo)**) com compras,
refeições, treinos e pesagens fictícias, só para você ver tudo
funcionando. Use **Apagar exemplo e começar do zero** (no aviso amarelo do
topo ou em **Ajustes**) quando quiser usar com os seus dados.

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

- **Vários usuários** — cada compra, refeição, treino e pesagem pertence a
  uma pessoa. O seletor no topo filtra todas as telas para uma pessoa ou
  mostra **Todos**, separado por pessoa. Os dados nunca se misturam.
- **Dashboard** — cartão por pessoa (peso atual, diferença, IMC, treino de
  hoje, treinos da semana, próxima refeição, itens a comprar, gasto do
  mês), refeições de hoje em linha do tempo, próximos treinos, avisos
  automáticos, lista de compras, gráfico de peso e últimas pesagens.
- **Compras** — lista em cards com emoji do produto, preço total
  (quantidade × preço unitário), local, prioridade e status
  (Planejado → Comprar → Comprado → Não comprado, com um clique). Abas por
  Feira, Mercado e Açougue. Catálogo de produtos com preço de referência,
  último preço pago e total gasto por produto.
- **Gastos** — gasto do mês x mês anterior, diferença, média mensal, maior
  compra, gráfico real x previsto dos últimos 6 meses, rosca por
  categoria, barras por local, produto e pessoa, e extrato do mês.
  Só entra como gasto o que estiver **Comprado**.
- **Refeições** — cronograma do dia por horário (café da manhã, lanches,
  almoço, jantar, ceia), navegação entre dias, clique no alimento para
  marcar como realizado, e **Repetir dia** para copiar um dia inteiro.
- **Academia** — treinos por data com grupos musculares e status, detalhe
  de cada treino com exercícios (séries, repetições, carga, descanso),
  volume total, progresso, **Repetir treino** e gráfico de evolução da
  carga por exercício.
- **Semana** — plano semanal Seg → Dom por pessoa, com destaque no dia de
  hoje; **Gerar treinos da semana** cria os treinos planejados de uma vez.
- **Evolução** — peso inicial, atual, diferença, variação no mês, peso
  médio, IMC com classificação, dias de acompanhamento, gráfico e
  histórico de pesagens.
- **Relatório** — fechamento do mês por pessoa: gasto, comparação com o
  mês anterior, compras, refeições, treinos feitos/planejados e peso do
  início ao fim do mês.
- **Ajustes** — backup, restauração, dados de exemplo e privacidade.

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
├── index.html              # estrutura da página (barra de guias, modal)
├── manifest.json           # app instalável (PWA)
├── sw.js                   # funciona offline depois de publicado
├── css/
│   └── style.css           # tema visual (o mesmo do sistema de finanças + componentes novos)
├── js/
│   ├── armazenamento.js    # salvar/carregar/exportar/importar dados + dados de exemplo
│   ├── fitness.js          # cálculos de peso, IMC, treinos, exercícios e plano semanal
│   ├── alimentacao.js      # cálculos de compras, gastos, catálogo e refeições
│   ├── graficos.js         # todos os gráficos (Chart.js)
│   ├── app.js              # interface: navegação, telas, modais, eventos
│   └── vendor/
│       └── chart.umd.min.js
└── assets/
    └── icons/              # ícones do app
```

Cada módulo só conversa com o de baixo: `app.js` desenha as telas e chama
`fitness.js` / `alimentacao.js`, que calculam tudo a partir do objeto de
dados entregue por `armazenamento.js`. Nenhum módulo de regra toca no DOM.

## Modelo de dados

Uma única chave no `localStorage` (`meuControle:v1`) guarda um objeto com:

| Coleção        | O que guarda                                                  |
| -------------- | ------------------------------------------------------------- |
| `usuarios`     | nome, altura, peso inicial, objetivo, data de início, cor     |
| `produtos`     | catálogo: nome, emoji, categoria, unidade, preço de referência |
| `compras`      | item, quantidade, unidade, preço unitário, local, status      |
| `refeicoes`    | data, horário, tipo de refeição, alimento, porção, status     |
| `planoSemanal` | dia da semana (1 = segunda … 7 = domingo), treino, grupos     |
| `treinos`      | data, nome, grupos musculares, status, duração                |
| `exercicios`   | treino, séries, repetições, carga, descanso, status           |
| `pesagens`     | data, peso, altura opcional                                   |

Tudo que não está nessa lista (peso atual, diferença, IMC, gasto do mês,
treinos da semana, próxima refeição…) é calculado na hora.

const formTransacao = document.getElementById('form-transacao');
const listaTransacoes = document.getElementById('lista-transacoes');
const filtroMes = document.getElementById('filtro-mes');
const mesLancamento = document.getElementById('mes-lancamento');
const selectCategoria = document.getElementById('categoria');
const selectTipo = document.getElementById('tipo');

// Define o mês atual como padrão
const hoje = new Date();
const mesAtualFormatado = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
filtroMes.value = mesAtualFormatado;
mesLancamento.value = mesAtualFormatado;

// Carrega os objetos JSON salvos no navegador
let transacoes = JSON.parse(localStorage.getItem('planilha_ods_dados')) || [];

function formatarMoeda(valor) {
    return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// =========================================
// AUTOMAÇÃO: CATEGORIA -> TIPO (SAÍDA / ENTRADA)
// =========================================
selectCategoria.addEventListener('change', () => {
    if (selectCategoria.value === 'Salario') {
        selectTipo.value = 'entrada';
    } else {
        selectTipo.value = 'saida';
    }
});

// =========================================
// ATUALIZAÇÃO DA INTERFACE E CÁLCULOS
// =========================================
function atualizarInterface() {
    listaTransacoes.innerHTML = '';
    const mesSelecionado = filtroMes.value;
    document.querySelectorAll('.label-mes-atual').forEach(el => el.innerText = mesSelecionado);

    let totalReceitas = 0;
    let totalDespesas = 0;

    const transacoesDoMes = transacoes.filter(item => item.mes === mesSelecionado);

    transacoesDoMes.forEach((item) => {
        const valorNum = Number(item.valor);
        if (item.tipo === 'entrada') totalReceitas += valorNum;
        else totalDespesas += valorNum;

        const tr = document.createElement('tr');
        tr.classList.add(item.tipo === 'entrada' ? 'linha-entrada' : 'linha-saida');

        tr.innerHTML = `
            <td>${item.descricao}</td>
            <td>${item.mes}</td>
            <td>${item.categoria}</td>
            <td>${item.tipo === 'entrada' ? 'Entrada' : 'Saída'}</td>
            <td>${formatarMoeda(valorNum)}</td>
            <td data-html2canvas-ignore="true">
                <button class="btn-excluir" onclick="removerTransacao(${item.id})">Excluir</button>
            </td>
        `;
        listaTransacoes.appendChild(tr);
    });

    document.getElementById('total-receitas').innerText = formatarMoeda(totalReceitas);
    document.getElementById('total-despesas').innerText = formatarMoeda(totalDespesas);
    document.getElementById('saldo-atual').innerText = formatarMoeda(totalReceitas - totalDespesas);

    verificarSaudeFinanceira(totalReceitas, totalDespesas);
    desenharGraficoTorres(mesSelecionado);
    desenharGraficoPizza(mesSelecionado);
    localStorage.setItem('planilha_ods_dados', JSON.stringify(transacoes));
}

function verificarSaudeFinanceira(receitas, despesas) {
    const elAlerta = document.getElementById('alerta-ods');
    const elMsg = document.getElementById('mensagem-alerta');

    if (receitas === 0 && despesas > 0) {
        elAlerta.classList.remove('oculto');
        elMsg.innerText = 'Você possui gastos previstos neste mês sem entradas registradas!';
        return;
    }

    if (receitas > 0) {
        const percentual = (despesas / receitas) * 100;
        if (percentual >= 100) {
            elAlerta.classList.remove('oculto');
            elMsg.innerText = `Perigo! Os gastos deste mês atingiram ${percentual.toFixed(1)}% da renda.`;
        } else if (percentual >= 70) {
            elAlerta.classList.remove('oculto');
            elMsg.innerText = `Atenção! Você comprometeu ${percentual.toFixed(1)}% da renda neste mês.`;
        } else {
            elAlerta.classList.add('oculto');
        }
    } else {
        elAlerta.classList.add('oculto');
    }
}

// =========================================
// GRÁFICO 1: TORRES NATIVAS (GASTOS POR MÊS)
// =========================================
function desenharGraficoTorres(mesSelecionado) {
    const canvas = document.getElementById('grafico-torres');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gastosPorMes = {};
    transacoes.forEach(item => {
        if (item.tipo === 'saida') {
            gastosPorMes[item.mes] = (gastosPorMes[item.mes] || 0) + Number(item.valor);
        }
    });

    const meses = Object.keys(gastosPorMes).sort();
    if (meses.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Lance um gasto para visualizar as torres mensais', canvas.width / 2, canvas.height / 2);
        return;
    }

    const valores = meses.map(m => gastosPorMes[m]);
    const maxValor = Math.max(...valores);
    const areaAltura = canvas.height - 60;
    const larguraBarra = Math.min(55, (canvas.width - 40) / meses.length - 15);
    const espacamento = (canvas.width - (larguraBarra * meses.length)) / (meses.length + 1);

    meses.forEach((mes, i) => {
        const valor = valores[i];
        const alturaBarra = (valor / maxValor) * areaAltura;
        const x = espacamento + i * (larguraBarra + espacamento);
        const y = canvas.height - 30 - alturaBarra;

        // Desenha a torre
        ctx.fillStyle = mes === mesSelecionado ? '#2563eb' : '#93c5fd';
        ctx.fillRect(x, y, larguraBarra, alturaBarra);

        // Valor acima da torre
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`R$${valor.toFixed(0)}`, x + larguraBarra / 2, y - 6);

        // Mês abaixo da torre
        ctx.fillStyle = '#475569';
        ctx.font = '11px sans-serif';
        ctx.fillText(mes, x + larguraBarra / 2, canvas.height - 12);
    });
}

// =========================================
// GRÁFICO 2: PIZZA NATIVA (POR CATEGORIA)
// =========================================
function desenharGraficoPizza(mesSelecionado) {
    const canvas = document.getElementById('grafico-pizza');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gastosPorCat = {};
    let totalMes = 0;

    transacoes.forEach(item => {
        if (item.tipo === 'saida' && item.mes === mesSelecionado) {
            const val = Number(item.valor);
            gastosPorCat[item.categoria] = (gastosPorCat[item.categoria] || 0) + val;
            totalMes += val;
        }
    });

    const categorias = Object.keys(gastosPorCat);
    if (categorias.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Sem gastos registrados neste mês', canvas.width / 2, canvas.height / 2);
        return;
    }

    const cores = Array.of('#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899');
    const centroX = 110;
    const centroY = canvas.height / 2;
    const raio = 85;
    let anguloInicial = 0;

    categorias.forEach((cat, i) => {
        const valor = gastosPorCat[cat];
        const fatia = (valor / totalMes) * 2 * Math.PI;
        const cor = cores[i % cores.length];

        // Desenha a fatia da pizza
        ctx.beginPath();
        ctx.moveTo(centroX, centroY);
        ctx.arc(centroX, centroY, raio, anguloInicial, anguloInicial + fatia);
        ctx.closePath();
        ctx.fillStyle = cor;
        ctx.fill();

        anguloInicial += fatia;

        // Desenha a legenda ao lado direito da pizza
        const legendaY = 35 + i * 28;
        ctx.fillStyle = cor;
        ctx.fillRect(220, legendaY - 10, 14, 14);

        const percentual = ((valor / totalMes) * 100).toFixed(0);
        ctx.fillStyle = '#1e293b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${cat} (${percentual}%)`, 242, legendaY + 2);
    });
}

// =========================================
// ADICIONAR E EXCLUIR LANÇAMENTOS
// =========================================
formTransacao.addEventListener('submit', (e) => {
    e.preventDefault();

    const mesEscolhido = mesLancamento.value;
    const novaTransacao = {
        id: Date.now(),
        descricao: document.getElementById('descricao').value,
        valor: parseFloat(document.getElementById('valor').value),
        mes: mesEscolhido,
        tipo: selectTipo.value,
        categoria: selectCategoria.value
    };

    transacoes.push(novaTransacao);
    filtroMes.value = mesEscolhido;
    
    document.getElementById('descricao').value = '';
    document.getElementById('valor').value = '';
    selectCategoria.value = 'Fatura';
    selectTipo.value = 'saida';
    mesLancamento.value = mesEscolhido;
    
    atualizarInterface();
});

function removerTransacao(id) {
    transacoes = transacoes.filter(item => item.id !== id);
    atualizarInterface();
}

filtroMes.addEventListener('change', atualizarInterface);

// =========================================
// GERAR PDF E EXPORTAR JSON
// =========================================
document.getElementById('btn-gerar-pdf').addEventListener('click', () => {
    if (typeof html2pdf === 'undefined') {
        window.print();
        return;
    }
    const elemento = document.getElementById('area-impressao-pdf');
    const opcoes = {
        margin: 10,
        filename: `Relatorio_Financeiro_${filtroMes.value}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opcoes).from(elemento).save();
});

document.getElementById('btn-exportar-json').addEventListener('click', () => {
    const dadosStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(transacoes, null, 2));
    const link = document.createElement('a');
    link.setAttribute("href", dadosStr);
    link.setAttribute("download", `planilha_ods_${filtroMes.value}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
});

// Inicializa a tela
atualizarInterface();

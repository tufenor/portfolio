// Carrega conteudo.json (ou prévia salva no navegador) e atualiza o site.
// Mantém o HTML estático como fallback: se o arquivo não existir, nada muda.
(function () {
  var CATS = [['cafes', 'Cafés'], ['dulces', 'Dulces'], ['salados', 'Salados']];
  var previa = new URLSearchParams(location.search).get('previa');
  var fonte = previa ? Promise.resolve(JSON.parse(localStorage.getItem('previaConteudo') || 'null')) : fetch('conteudo.json', { cache: 'no-store' }).then(function (r) { return r.json(); });

  fonte.then(function (c) {
    if (!c) return;

    // hero
    var h1 = document.querySelector('.hero h1');
    if (h1 && c.titulo1) {
      h1.innerHTML = (c.titulo1 || '') + '<br><em>' + (c.titulo2 || '') + '</em>';
    }
    var sub = document.querySelector('.hero p');
    if (sub && c.subtitulo) sub.textContent = c.subtitulo;

    // whatsapp em todos os links
    if (c.whatsapp) {
      var tel = String(c.whatsapp).replace(/\D/g, '');
      document.querySelectorAll('a[href*="wa.me"]').forEach(function (a) {
        try {
          var u = new URL(a.getAttribute('href'));
          a.setAttribute('href', 'https://wa.me/' + tel + u.search);
        } catch (e) {}
      });
    }

    // horários
    if (c.horario) {
      var linhas = document.querySelectorAll('.linha-hora');
      var vals = [c.horario.lv, c.horario.sab, c.horario.dom];
      linhas.forEach(function (l, i) { if (vals[i]) l.querySelector('b').textContent = vals[i]; });
    }

    // menu com fotos por item
    if (c.itens) {
      var abas = document.querySelector('.abas');
      var primeiroPainel = document.querySelector('.painel');
      var mae = primeiroPainel ? primeiroPainel.parentNode : null;
      if (abas && mae) {
        abas.innerHTML = '';
        mae.querySelectorAll('.painel').forEach(function (p) { p.remove(); });
        CATS.forEach(function (par, i) {
          var chave = par[0], rotulo = par[1];
          var itens = c.itens[chave] || [];
          if (!itens.length) return;
          var b = document.createElement('button');
          b.className = 'aba' + (i === 0 ? ' ativa' : '');
          b.textContent = rotulo;
          b.setAttribute('data-aba', chave);
          b.setAttribute('role', 'tab');
          abas.appendChild(b);

          var painel = document.createElement('div');
          painel.className = 'painel' + (i === 0 ? ' ativo' : '');
          painel.setAttribute('data-painel', chave);
          itens.forEach(function (it) {
            var art = document.createElement('article');
            art.className = 'item';
            art.innerHTML =
              (it.foto ? '<div class="item-foto"><img src="' + it.foto + '" alt="' + (it.nome || '') + '" loading="lazy"></div>' : '') +
              '<div><h3></h3><p></p></div><span class="preco"></span>';
            art.querySelector('h3').textContent = it.nome || '';
            art.querySelector('p').textContent = it.detalhe || '';
            art.querySelector('.preco').textContent = it.preco || '';
            painel.appendChild(art);
          });
          mae.appendChild(painel);
        });

        // reativa as abas
        abas.querySelectorAll('.aba').forEach(function (botao) {
          botao.addEventListener('click', function () {
            abas.querySelectorAll('.aba').forEach(function (x) { x.classList.remove('ativa'); });
            mae.querySelectorAll('.painel').forEach(function (x) { x.classList.remove('ativo'); });
            botao.classList.add('ativa');
            var alvo = mae.querySelector('[data-painel="' + botao.dataset.aba + '"]');
            if (alvo) alvo.classList.add('ativo');
          });
        });
      }
    }
  }).catch(function () { /* mantém o conteúdo estático */ });
})();

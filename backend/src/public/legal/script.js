(function () {
  // Alterna o índice em telas estreitas.
  var toggle = document.querySelector('[data-nav-toggle]');
  var toc = document.querySelector('.toc');
  if (toggle && toc) {
    toggle.addEventListener('click', function () {
      var isOpen = toc.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Fecha o índice (em telas estreitas) depois de clicar num link.
  document.querySelectorAll('.toc a').forEach(function (link) {
    link.addEventListener('click', function () {
      if (toc && window.matchMedia('(max-width: 860px)').matches) {
        toc.classList.remove('open');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // Destaca no índice a seção visível no momento.
  var sections = Array.prototype.slice.call(document.querySelectorAll('section.clause[id]'));
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  if (sections.length && tocLinks.length && 'IntersectionObserver' in window) {
    var linkById = {};
    tocLinks.forEach(function (link) {
      linkById[link.getAttribute('href').replace('#', '')] = link;
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var link = linkById[entry.target.id];
          if (!link) return;
          if (entry.isIntersecting) {
            tocLinks.forEach(function (l) {
              l.classList.remove('active');
            });
            link.classList.add('active');
          }
        });
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 }
    );

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  // Botão "voltar ao topo".
  var backTop = document.querySelector('[data-back-top]');
  if (backTop) {
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
})();
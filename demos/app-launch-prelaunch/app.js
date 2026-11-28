(function(){
  var config=window.DEMO_CONTENT||{};
  document.querySelectorAll('[data-copy="brand"]').forEach(function(el){el.textContent=config.brand||'NOVA';});
  ['eyebrow','heroLead','heroEmphasis','heroDescription'].forEach(function(key){var el=document.querySelector('[data-copy="'+key+'"]');if(el&&config[key])el.textContent=config[key];});
  document.getElementById('year').textContent=new Date().getFullYear();
  var menu=document.querySelector('.menu-toggle');var nav=document.getElementById('main-nav');
  menu.addEventListener('click',function(){var open=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!open));nav.classList.toggle('open',!open);});
  nav.querySelectorAll('a').forEach(function(link){link.addEventListener('click',function(){menu.setAttribute('aria-expanded','false');nav.classList.remove('open');});});
  var dialog=document.getElementById('video-dialog');
  document.querySelectorAll('[data-video-open]').forEach(function(button){button.addEventListener('click',function(){dialog.showModal();});});
  document.querySelectorAll('[data-video-close]').forEach(function(button){button.addEventListener('click',function(){dialog.close();});});
  dialog.addEventListener('click',function(event){if(event.target===dialog)dialog.close();});
  var form=document.getElementById('signup-form');var message=document.getElementById('form-message');
  form.addEventListener('submit',function(event){event.preventDefault();if(!form.reportValidity())return;message.textContent='Prévia demonstrativa: o formulário validou os campos, mas nenhum dado foi enviado ou salvo.';message.classList.add('success');form.reset();});
  var revealItems=document.querySelectorAll('.reveal');
  if('IntersectionObserver'in window){var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}});},{threshold:.12});revealItems.forEach(function(item){observer.observe(item);});}else{revealItems.forEach(function(item){item.classList.add('visible');});}
  document.querySelectorAll('.faq-list details').forEach(function(item){item.addEventListener('toggle',function(){var plus=item.querySelector('summary span');plus.textContent=item.open?'−':'+';});});
})();

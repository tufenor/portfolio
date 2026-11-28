(() => {
  const copy = window.ELOVINZE_DEMO?.copy;
  if (copy) document.querySelectorAll('[data-copy]').forEach((element) => {
    const key = element.dataset.copy;
    if (copy[key] != null) element.textContent = copy[key];
  });
  const image = document.querySelector('[data-demo-image="collectionOne"]');
  if (image && window.ELOVINZE_DEMO?.images?.collectionOne) image.src = window.ELOVINZE_DEMO.images.collectionOne;
  const button = document.querySelector('#share-card');
  const feedback = document.querySelector('#share-feedback');
  if (!button || !feedback) return;
  button.addEventListener('click', async () => {
    const shareData = { title: document.title, text: 'Demonstração conceitual de cartão digital', url: location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(location.href);
        feedback.textContent = 'Link da demonstração copiado.';
      } else feedback.textContent = 'Seu navegador não disponibilizou compartilhamento.';
    } catch (error) {
      if (error?.name !== 'AbortError') feedback.textContent = 'Não foi possível compartilhar agora.';
    }
  });
})();

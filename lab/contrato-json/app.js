const types = {
  string: value => typeof value === 'string',
  number: value => Number.isFinite(value),
  integer: value => Number.isInteger(value),
  boolean: value => typeof value === 'boolean',
  object: value => value !== null && typeof value === 'object' && !Array.isArray(value),
  array: value => Array.isArray(value),
  null: value => value === null,
};

function parseObject(input, label) {
  let value;
  try {
    value = JSON.parse(input.value);
  } catch {
    throw new Error(`${label}: use JSON válido.`);
  }
  if (!types.object(value)) {
    throw new Error(`${label}: use um objeto JSON.`);
  }
  return value;
}

const form = document.querySelector('#verificador');
const contractInput = document.querySelector('#contrato');
const exampleInput = document.querySelector('#exemplo');
const status = document.querySelector('#status');
const problems = document.querySelector('#erros');

form.addEventListener('submit', event => {
  event.preventDefault();
  problems.replaceChildren();
  problems.hidden = true;

  try {
    const rules = Object.entries(parseObject(contractInput, 'Contrato'));
    const example = parseObject(exampleInput, 'Exemplo');
    if (rules.length === 0) {
      throw new Error('Contrato: adicione pelo menos um campo.');
    }

    for (const [field, type] of rules) {
      if (typeof type !== 'string' || !Object.hasOwn(types, type)) {
        throw new Error(`Contrato: tipo inválido para “${field}”.`);
      }
    }
    for (const [field, type] of rules) {
      let message;
      if (!Object.hasOwn(example, field)) {
        message = `“${field}” é obrigatório.`;
      } else if (!types[type](example[field])) {
        message = `“${field}” deve ser do tipo ${type}.`;
      }
      if (message) {
        const item = document.createElement('li');
        item.textContent = message;
        problems.append(item);
      }
    }
    problems.hidden = problems.childElementCount === 0;
    status.textContent = problems.hidden
      ? `Exemplo válido. ${rules.length} campo(s) verificado(s).`
      : `Exemplo inválido. Confira ${problems.childElementCount} campo(s) abaixo.`;
  } catch (error) {
    status.textContent = error.message;
  }
});

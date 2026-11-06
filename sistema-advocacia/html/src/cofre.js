/* Cofre: criptografia feita no navegador. A senha do escritório vira uma chave que protege TODOS os dados
   antes de eles irem para o armazenamento (quem não tem a senha só vê texto cifrado). AES-256-GCM + PBKDF2. */
const Cofre = (() => {
  const te = new TextEncoder(), td = new TextDecoder();
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  const ITER = 600000;

  function b64(buf) {
    const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(s) {
    const bin = atob(s), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  async function chaveDaSenha(senha, salt, iter) {
    const base = await subtle.importKey('raw', te.encode(String(senha).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function cifrarBytes(chave, u8) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, chave, u8));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
    return out;
  }
  async function decifrarBytes(chave, u8) {
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: u8.subarray(0, 12) }, chave, u8.subarray(12)));
  }
  const importar = (raw) => subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);

  // "meta" é o que fica guardado em claro: sal, iterações, a chave mestra EMBRULHADA pela senha e um verificador
  async function montarMeta(master, senha, iter = ITER) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const kek = await chaveDaSenha(senha, salt, iter);
    const raw = new Uint8Array(await subtle.exportKey('raw', master));
    return { v: 1, salt: b64(salt), iter, wrapped: b64(await cifrarBytes(kek, raw)), ver: b64(await cifrarBytes(master, te.encode('advocacia-ok'))) };
  }
  async function criar(senha, iter = ITER) {
    const master = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    return { master, meta: await montarMeta(master, senha, iter) };
  }
  async function abrir(meta, senha) {
    try {
      const kek = await chaveDaSenha(senha, unb64(meta.salt), meta.iter);
      return await importar(await decifrarBytes(kek, unb64(meta.wrapped)));
    } catch { return null; }                                       // senha errada (a autenticação do GCM falha)
  }
  async function abrirComChaveSalva(meta, rawB64) {
    try {
      const m = await importar(unb64(rawB64));
      return td.decode(await decifrarBytes(m, unb64(meta.ver))) === 'advocacia-ok' ? m : null;
    } catch { return null; }
  }
  const exportar = async (master) => b64(new Uint8Array(await subtle.exportKey('raw', master)));
  const trocarSenha = (master, novaSenha, iter = ITER) => montarMeta(master, novaSenha, iter);

  // um campo = um valor JSON cifrado ("iv+texto" em base64). Campos separados permitem gravar só o que mudou.
  async function campo(master, valor) { return b64(await cifrarBytes(master, te.encode(JSON.stringify(valor === undefined ? null : valor)))); }
  async function lerCampo(master, s) { return JSON.parse(td.decode(await decifrarBytes(master, unb64(s)))); }
  const bytes = async (master, u8) => b64(await cifrarBytes(master, u8));
  const lerBytes = (master, s) => decifrarBytes(master, unb64(s));
  async function sha256(u8) {
    return [...new Uint8Array(await subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // exigência mínima para a senha do escritório
  function avaliarSenha(s) {
    s = String(s || '');
    if (s.length < 12) return 'Use ao menos 12 caracteres (de preferência uma frase longa).';
    if (!/[A-Za-zÀ-ÿ]/.test(s) || !/\d/.test(s)) return 'Misture letras e números.';
    if (/^(.)\1+$/.test(s) || /^(1234|abcd|senha|password|qwer)/i.test(s)) return 'Essa senha é fácil demais de adivinhar.';
    return null;
  }
  return { criar, abrir, abrirComChaveSalva, exportar, trocarSenha, campo, lerCampo, bytes, lerBytes, sha256, b64, unb64, avaliarSenha, ITER };
})();

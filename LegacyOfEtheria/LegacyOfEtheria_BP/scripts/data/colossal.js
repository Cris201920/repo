// data/colossal.js - 8.6: MAGIAS COLOSSAIS (escala de dezenas de blocos). Aprendidas com PONTOS DE HABILIDADE (sp) a partir de nível alto,
// equipáveis na hotbar de magias como qualquer ativa. exec.kind "colossal" -> systems/colossal.js (conjuração -> impacto -> dissipação).
// Dano: mesma fórmula das habilidades (power × atributo), em área, no máx. COLOSSAL.maxTargets alvos por golpe. Não quebram blocos.
const C = (id, o) => ({ id, type: "active", req: [], cat: "Magia", ...o, exec: { kind: "colossal", stat: "intelligence", ...o.exec } });
export const COLOSSALS = [
  C("cs_runic_seal", { name: "Selo Rúnico Colossal", element: "arcane", rarity: "legendary", mana: 160, cd: 80, level: 70, sp: 8,
    desc: "Desenha no chão um círculo de runas de 32 blocos que gira e se fecha; o selo explode em pilares de luz e paralisa quem está dentro.",
    exec: { range: 34, radius: 16, power: 4.2 } }),
  C("cs_heaven_pillar", { name: "Pilar do Firmamento", element: "light", rarity: "legendary", mana: 150, cd: 75, level: 65, sp: 7,
    desc: "Um selo no céu concentra a luz e um pilar colossal desce sobre o alvo, queimando a área por 2 s.",
    exec: { range: 34, radius: 7, power: 1.7 } }),
  C("cs_ringed_sun", { name: "Sol Anelado", element: "fire", rarity: "legendary", mana: 180, cd: 90, level: 75, sp: 8,
    desc: "Um sol envolto em três anéis se forma no céu, desce e explode no alvo, deixando uma cratera em chamas.",
    exec: { range: 36, radius: 12, power: 5 } }),
  C("cs_tempest_judgement", { name: "Juízo da Tempestade", element: "lightning", rarity: "epic", mana: 140, cd: 70, level: 60, sp: 6,
    desc: "Nuvens negras giram sobre 36 blocos; raios caem nos inimigos por 5 s e um raio final fulmina o centro.",
    exec: { range: 32, radius: 18, power: 1.3 } }),
  C("cs_cataclysm_wave", { name: "Onda do Cataclismo", element: "earth", rarity: "epic", mana: 130, cd: 65, level: 60, sp: 6,
    desc: "Golpeia o chão: abre uma cratera ao seu redor e uma onda de choque varre 20 blocos, arremessando e atordoando.",
    exec: { self: true, radius: 20, power: 3.4 } }),
  C("cs_coin_circle", { name: "Círculo das Mil Moedas", element: "gold", rarity: "legendary", mana: 150, cd: 75, level: 65, sp: 7,
    desc: "Moedas de ouro orbitam você e crescem num círculo gigante; chovem sobre a área mirada e terminam numa explosão dourada.",
    exec: { range: 30, radius: 11, power: 1.4 } }),
];

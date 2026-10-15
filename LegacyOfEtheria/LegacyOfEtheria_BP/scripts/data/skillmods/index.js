// data/skillmods/index.js - lista de módulos de habilidades (camada modular, 6.46). Para adicionar um conjunto novo de habilidades:
// crie data/skillmods/<nome>.js no formato de angelic.js e acrescente aqui. O registro em data/skills.js valida e rejeita entradas inválidas.
import angelic from "./angelic.js";
export const SKILL_MODULES = [angelic];

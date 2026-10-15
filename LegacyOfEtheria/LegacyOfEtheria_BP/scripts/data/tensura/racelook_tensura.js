// Visual racial Tensura — catálogo moderno + compatibilidade com formas antigas.
import { RACE_LOOK as MODERN_LOOK } from "./racelook_modern.js";
import { RACE_LOOK as LEGACY_LOOK } from "./racelook_legacy_extra.js";

export const RACE_LOOK = {
  ...LEGACY_LOOK,
  ...MODERN_LOOK,
  // Os quatro estágios angelicais especiais do catálogo moderno não existiam no
  // arquivo visual antigo; usam as geometrias já presentes no RP.
  seraphim: { wings: 9, halo: 2, aura: 2 },
  divine_angel: { wings: 9, halo: 1, aura: 2 },
  fallen_angel: { wings: 4, horns: 4, tail: 1, aura: 1 },
  fallen_seraphim: { wings: 4, horns: 7, tail: 1, halo: 4, aura: 1 },
};

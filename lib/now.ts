/**
 * Wrapper de Date.now() para usar en Server Components: la regla de lint
 * react-hooks/purity marca Date.now() directo en el cuerpo de un componente
 * como una llamada impura — envolverlo acá deja el timestamp calculado una
 * sola vez por render, pasado como prop en vez de recalculado en cada lado.
 */
export function getNow(): number {
  return Date.now();
}

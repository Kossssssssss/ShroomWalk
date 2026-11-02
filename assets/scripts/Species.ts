export const SPECIES_NAMES: Record<string, string> = {
  Porcini: 'Боровики',
  Chanterelle: 'Лисички',
  Amanita: 'Мухомори',
};

export const PICK_NAMES: Record<string, string> = {
  Porcini: 'боровик',
  Chanterelle: 'лисичку',
  Amanita: 'мухомор',
};

export function formatCounts( counts: ReadonlyMap<string, number> ): string
{
  const parts: string[] = [];
  for ( const [species, count] of counts )
  {
    if ( count > 0 ) parts.push( `${SPECIES_NAMES[species] ?? species} ${count}` );
  }
  return parts.join( ' · ' );
}

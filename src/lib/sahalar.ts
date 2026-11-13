// İstemci tarafının da kullanabildiği, Node'a bağımlı olmayan sabitler.
export const SAHALAR = { acik: 'Açık Saha', kapali: 'Kapalı Saha' } as const
export type Saha = keyof typeof SAHALAR

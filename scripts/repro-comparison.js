const { matchCards } = require('../lib/comparison.ts')

const tcg = [
  {
    productId: 1,
    name: 'Luffy & Ace (Parallel)',
    groupName: 'Starter Deck EX: Luffy & Ace',
    setName: 'Starter Deck EX: Luffy & Ace',
    imageUrl: '',
    url: 'https://tcg/1',
    price: { marketPrice: 12 },
    extendedData: [{ name: 'Number', value: 'ST30-001' }],
  },
  {
    productId: 2,
    name: 'Can You Still Fight, Luffy?! Of Course!! (Parallel)',
    groupName: 'Starter Deck EX: Luffy & Ace',
    setName: 'Starter Deck EX: Luffy & Ace',
    imageUrl: '',
    url: 'https://tcg/2',
    price: { marketPrice: 10 },
    extendedData: [{ name: 'Number', value: 'ST30-016' }],
  },
  {
    productId: 3,
    name: 'DON!! Card (Gear 4 Luffy)',
    groupName: 'Premium Booster -The Best- Vol. 2',
    setName: 'Premium Booster -The Best- Vol. 2',
    imageUrl: '',
    url: 'https://tcg/3',
    price: { marketPrice: 20 },
    extendedData: [],
  },
]

const liga = [
  {
    name: 'Luffy & Ace (Parallel)',
    numericCode: 'ST30-001-PA',
    price: 100,
    currency: 'BRL',
    imageUrl: '',
    url: 'https://liga/1',
    set: 'Starter Deck EX: Luffy & Ace',
  },
  {
    name: 'Can You Still Fight, Luffy?! Of Course!! (Parallel)',
    numericCode: 'ST30-016-PA',
    price: 50,
    currency: 'BRL',
    imageUrl: '',
    url: 'https://liga/2',
    set: 'Starter Deck EX: Luffy & Ace',
  },
  {
    name: 'DON!! Card (Gear 4 Luffy)',
    numericCode: 'DON-009',
    price: 8,
    currency: 'BRL',
    imageUrl: '',
    url: 'https://liga/3',
    set: 'Premium Booster - One Piece Card The Best - Vol. 2',
  },
]

const results = matchCards(tcg, liga, 0.2)
console.log(JSON.stringify(results, null, 2))

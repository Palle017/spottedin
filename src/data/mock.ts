export type Listing = {
  id: string
  brand: string
  size: string
  price: number
  originalPrice?: number
  likes: number
  img: string
}

export const user = { name: 'Manasa', handle: 'manasa', initials: 'MP' }

export const listings: Listing[] = [
  { id: '1', brand: "Levi's", size: 'M', price: 1299, likes: 42, img: 'https://picsum.photos/seed/spotted-1/600/600' },
  { id: '2', brand: 'Nike', size: 'L', price: 2499, originalPrice: 3499, likes: 67, img: 'https://picsum.photos/seed/spotted-2/600/600' },
  { id: '3', brand: 'Zara', size: 'S', price: 899, likes: 12, img: 'https://picsum.photos/seed/spotted-3/600/600' },
  { id: '4', brand: 'H&M', size: 'XL', price: 599, likes: 8, img: 'https://picsum.photos/seed/spotted-4/600/600' },
  { id: '5', brand: 'Carhartt', size: 'M', price: 3299, likes: 55, img: 'https://picsum.photos/seed/spotted-5/600/600' },
  { id: '6', brand: 'Polo Ralph Lauren', size: 'L', price: 2199, originalPrice: 3999, likes: 80, img: 'https://picsum.photos/seed/spotted-6/600/600' },
  { id: '7', brand: 'FabIndia', size: 'S', price: 799, likes: 15, img: 'https://picsum.photos/seed/spotted-7/600/600' },
  { id: '8', brand: 'Adidas', size: 'M', price: 1899, likes: 34, img: 'https://picsum.photos/seed/spotted-8/600/600' },
  { id: '9', brand: "Levi's", size: 'XL', price: 1599, likes: 21, img: 'https://picsum.photos/seed/spotted-9/600/600' },
  { id: '10', brand: 'Nike', size: 'S', price: 4999, originalPrice: 6499, likes: 74, img: 'https://picsum.photos/seed/spotted-10/600/600' },
  { id: '11', brand: 'Zara', size: 'M', price: 1099, likes: 9, img: 'https://picsum.photos/seed/spotted-11/600/600' },
  { id: '12', brand: 'H&M', size: 'L', price: 449, likes: 5, img: 'https://picsum.photos/seed/spotted-12/600/600' },
  { id: '13', brand: 'Carhartt', size: 'XL', price: 2899, likes: 47, img: 'https://picsum.photos/seed/spotted-13/600/600' },
  { id: '14', brand: 'Polo Ralph Lauren', size: 'S', price: 1799, likes: 29, img: 'https://picsum.photos/seed/spotted-14/600/600' },
  { id: '15', brand: 'FabIndia', size: 'M', price: 399, likes: 6, img: 'https://picsum.photos/seed/spotted-15/600/600' },
  { id: '16', brand: 'Adidas', size: 'XL', price: 2299, originalPrice: 2999, likes: 38, img: 'https://picsum.photos/seed/spotted-16/600/600' },
]

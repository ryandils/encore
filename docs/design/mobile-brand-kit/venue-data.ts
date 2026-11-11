export interface VenueProfile {
  slug: string;
  name: string;
  category: string;
  description: string;
  address: string;
  occupancy: number;
  capacity: number;
  hours: readonly [string, string][];
}

export const venues: readonly VenueProfile[] = [
  {
    slug: 'north-room', name: 'The North Room', category: 'Listening bar',
    description: 'Low lights. Good records. A little room for a longer night.',
    address: '12 Example Lane, East Quarter', occupancy: 84, capacity: 120,
    hours: [['Monday', 'Closed'], ['Tuesday', '5 PM - 12 AM'], ['Wednesday', '5 PM - 12 AM'], ['Thursday', '5 PM - 1 AM'], ['Friday', '5 PM - 2 AM'], ['Saturday', '5 PM - 2 AM'], ['Sunday', '4 PM - 10 PM']],
  },
  {
    slug: 'side-b', name: 'Side B', category: 'Cocktail bar',
    description: 'A good drink, a favorite track, and a seat for the next conversation.',
    address: '24 Example Lane, East Quarter', occupancy: 32, capacity: 80,
    hours: [['Monday', 'Closed'], ['Tuesday', 'Closed'], ['Wednesday', '6 PM - 12 AM'], ['Thursday', '6 PM - 1 AM'], ['Friday', '6 PM - 2 AM'], ['Saturday', '6 PM - 2 AM'], ['Sunday', '5 PM - 11 PM']],
  },
  {
    slug: 'last-light', name: 'Last Light', category: 'Neighborhood bar',
    description: 'Your last stop, or the start of something. Come as you are.',
    address: '36 Example Lane, East Quarter', occupancy: 57, capacity: 60,
    hours: [['Monday', '4 PM - 11 PM'], ['Tuesday', '4 PM - 11 PM'], ['Wednesday', '4 PM - 11 PM'], ['Thursday', '4 PM - 12 AM'], ['Friday', '4 PM - 1 AM'], ['Saturday', '3 PM - 1 AM'], ['Sunday', '3 PM - 10 PM']],
  },
];

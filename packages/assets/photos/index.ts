/// <reference path='./webp.d.ts' />
/**
 * NYC photos for image cards (the card slider and anything else that wants a
 * district photo). Bundled, never hotlinked: each is a 1200x800 WebP cropped
 * and compressed from a Wikimedia Commons original. Credits and licences are
 * listed per photo below and in packages/ui/THIRD-PARTY-NOTICES.md.
 *
 * `source` is whatever the bundler gives a static image import: a URL string
 * (Vite), StaticImageData (Next) or an asset id number (Metro). The kit Image
 * takes all three. `blurDataURL` is a 24x16 WebP of the same crop, shown
 * while the full photo loads.
 */

import downtownOneWtc from './downtown-one-wtc.webp';
import downtownNyse from './downtown-nyse.webp';
import midtownEmpireSunset from './midtown-empire-sunset.webp';
import midtownTimesSquare from './midtown-times-square.webp';
import midtownChryslerSpire from './midtown-chrysler-spire.webp';
import harlemApollo from './harlem-apollo.webp';
import harlemBrownstoneStoops from './harlem-brownstone-stoops.webp';
import harlemLenoxRowhouses from './harlem-lenox-rowhouses.webp';
import megacityBrooklynBridgeNight from './megacity-brooklyn-bridge-night.webp';
import megacityBridgeDeck from './megacity-bridge-deck.webp';

export type PhotoDistrict = 'downtown' | 'midtown' | 'harlem' | 'megacity';
export type PhotoSource = string | number | { src: string; width: number; height: number };

export interface PhotoCredit {
  author: string;
  license: string;
  /** Licence text, when the licence has one. */
  licenseUrl?: string;
  /** The Commons file page the photo came from. */
  sourceUrl: string;
}

export interface NycPhoto {
  id: string;
  source: PhotoSource;
  /** Describes what the photo shows, for screen readers. */
  alt: string;
  district: PhotoDistrict;
  /** The landmark or street. */
  title: string;
  /** Where it is, short enough for one line. */
  place: string;
  width: number;
  height: number;
  blurDataURL: string;
  credit: PhotoCredit;
}

export const NYC_PHOTOS: readonly NycPhoto[] = [
  {
    id: 'downtown-one-wtc',
    source: downtownOneWtc,
    alt: 'One World Trade Center, a tapering blue glass tower with a spire, seen from the street against a clear sky',
    district: 'downtown',
    title: 'One World Trade Center',
    place: 'Lower Manhattan',
    width: 1200,
    height: 800,
    blurDataURL: 'data:image/webp;base64,UklGRn4AAABXRUJQVlA4IHIAAABwBACdASoYABAAPtFWo0uoJKMhsAgBABoJYgCdMoRwACkOQ8uRBHqj7pO2AAD+5yAv9ads4r6DcbdgkRRj+qs+PfrfPcbkSo4C1ssKxTeWnHueHTZ6uGrZUUnmfeBKVOMPYrQSPJ2t9a1KE/K91cLtpAA=',
    credit: { author: 'Mkdasher64', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:One_World_Trade_Center(Freedom_Tower).jpg' },
  },
  {
    id: 'downtown-nyse',
    source: downtownNyse,
    alt: 'The carved New York Stock Exchange sign on the marble facade on Wall Street, with an American flag above it',
    district: 'downtown',
    title: 'Wall Street',
    place: 'Broad St at Wall St',
    width: 1200,
    height: 800,
    blurDataURL: 'data:image/webp;base64,UklGRqQAAABXRUJQVlA4IJgAAAAQBACdASoYABAAPtFUo0uoJKMhsAgBABoJZQC2yBU6WAu4XaV2mICNgAD8gqV+3HVQxO9+fcv2FfOOOaalleRLQduV5+5Be2yxA6cenAMOojZH/mjbcA+GEINae/PSF34L9Fy2N+AWFz9oAWCO477CdznkkXFUc1r/WaMZM00PDK1nM4JIrmCanofwOLDZk3IJS594F4AAAA==',
    credit: { author: 'Balon Greyjoy', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:New_York_Stock_Exchange_Entrance.jpg' },
  },
  {
    id: 'midtown-empire-sunset',
    source: midtownEmpireSunset,
    alt: 'The Midtown skyline at sunset with the Empire State Building in the centre and the Chrysler Building to the right, under an orange sky',
    district: 'midtown',
    title: 'Empire State Building',
    place: 'Fifth Ave and 34th St',
    width: 1200,
    height: 800,
    blurDataURL: 'data:image/webp;base64,UklGRrAAAABXRUJQVlA4IKQAAACwBACdASoYABAAPtFUo0uoJKMhsAgBABoJbACdMoRwAdCJBwPAZjGjkvJDQ8oAAP7oDTV8qgkKHcxlQtUnwmFavUSOGA8pcYc1AN1jVByJTnJqvKipU5ZTEGrGLB6x/Y2/2HdC16gio/LsIYm6o6q1Iz+WWcs8tvuKf2N2Wqj+S8WF83QUeWbN4RJFDvech+KQ6m6TMmfkV17mfmngffsw4mAAAA==',
    credit: { author: 'Michael Discenza', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Empire_State_Building_during_sunset.jpg' },
  },
  {
    id: 'midtown-times-square',
    source: midtownTimesSquare,
    alt: 'Times Square at sunset, crowds crossing the street between towers covered in lit billboards',
    district: 'midtown',
    title: 'Times Square',
    place: 'Broadway and Seventh Ave',
    width: 1200,
    height: 800,
    blurDataURL: 'data:image/webp;base64,UklGRrAAAABXRUJQVlA4IKQAAABwBACdASoYABAAPtFUo0uoJKMhsAgBABoJQBUfbwAOKxWaNLDO/xbwnuFTSAD+7qZ7q7pf/RZL8FF94pH7DPRn38iKGdWNH8I41awBTRdSjA9G3AnROLg3n1bOkKx1PEkS1SjKRGMX3eWABgTLFJZybzZGdDjkeKzGe7i5P38flN4RBi7pefjeyBwtIg8BtQ742c7xDxnK4AL+K3olYd79ai4AAA==',
    credit: { author: 'Luca Bravo', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sunset_at_Times_Square,_New_York_City_(2017).jpg' },
  },
  {
    id: 'midtown-chrysler-spire',
    source: midtownChryslerSpire,
    alt: "The Chrysler Building's stainless steel crown of stacked arches and triangular windows, rising to its spire against a blue sky",
    district: 'midtown',
    title: 'Chrysler Building',
    place: 'Lexington Ave and 42nd St',
    width: 1200,
    height: 800,
    blurDataURL: 'data:image/webp;base64,UklGRlwAAABXRUJQVlA4IFAAAACwAwCdASoYABAAPtFUo0uoJKMhsAgBABoJQBOmUABLZE/hb+/ugAD+nsV0H1apIPqbUvsfQAG561sZrlRUP2IfHfrD2oMqps2E7B5ucwAAAA==',
    credit: { author: 'Carol M. Highsmith', license: 'Public domain (Library of Congress, Carol M. Highsmith Archive)', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Chrysler_Building_spire,_Manhattan,_by_Carol_Highsmith_(LOC_highsm.04444).jpg' },
  },
  {
    id: 'harlem-apollo',
    source: harlemApollo,
    alt: 'The Apollo Theater on 125th Street, its tall red and white vertical APOLLO sign above the marquee and box office',
    district: 'harlem',
    title: 'Apollo Theater',
    place: '125th St, Harlem',
    width: 1200,
    height: 800,
    blurDataURL: 'data:image/webp;base64,UklGRpYAAABXRUJQVlA4IIoAAAAwBACdASoYABAAPtFWo0uoJKMhsAgBABoJQBOgBCcxBdFJqUMmfrPYDgAA/c6J+F7VD8kLmjS8ZeMt8N87hXyyeFph0rjc4Di6S+cwKRSfIvkNdMS13GEOj3rJgSdEwXjAEDgqqOPz1/ngEu/49h5jGFsleKJ8H9UZNdfHYH3RzkyScjjuA43jAAA=',
    credit: { author: 'Erik Drost', license: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Apollo_Theater_(6279250673).jpg' },
  },
  {
    id: 'harlem-brownstone-stoops',
    source: harlemBrownstoneStoops,
    alt: 'A row of Harlem brownstones with high stoops and black iron railings running down a tree-lined sidewalk',
    district: 'harlem',
    title: 'Brownstone row',
    place: 'Harlem side street',
    width: 1200,
    height: 800,
    blurDataURL: 'data:image/webp;base64,UklGRrQAAABXRUJQVlA4IKgAAACQBACdASoYABAAPtFUo0uoJKMhsAgBABoJZACdMoACj7WO7BMpDara1s9oq5AA9rzCHufkw/TRIUc3WHLdb150agZDZMYyFZajakuh+G34qvCaPFRV2CrRq7hTgTlP1hnhZicnFx3rg0fbNdBkDSKlLJEEJbi26RnvyocLrX/y5Oz2YcZayVdRIjyvpAupFMr2udt1obM6zL6XrqCHBv0T7nf6UN0AAAA=',
    credit: { author: 'Paul Lowry', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Harlem,_New_York_brownstones.jpg' },
  },
  {
    id: 'harlem-lenox-rowhouses',
    source: harlemLenoxRowhouses,
    alt: 'A long four-storey run of brownstone rowhouses with cornices and stoops on Lenox Avenue under a blue sky',
    district: 'harlem',
    title: 'Lenox Avenue rowhouses',
    place: 'Lenox Ave at 123rd St',
    width: 1200,
    height: 800,
    blurDataURL: 'data:image/webp;base64,UklGRsgAAABXRUJQVlA4ILwAAABwBACdASoYABAAPtFUo0uoJKMhsAgBABoJaAC7LoAEKIMEvWb9li84NLIMAAD+5GDnI777vvoOve7Vdv2UHJJqlHtk47nySIg5pdBqCYzOsjcCBInvrpH9CUrHczTfD5lVcOWzZXyfSQdDMNHGAG3LIma+5S7Y0Mt7u+p5fjucu0/7CJFNMbRVQbg/PevQydkwqnkino9DUA0+nkRPkc+UW5WGG0qmke1xOkG1bKH+Sju+4T+C3W4YGkDAAA==',
    credit: { author: 'Jim.henderson', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lenox_123_rowhouses_jeh.jpg' },
  },
  {
    id: 'megacity-brooklyn-bridge-night',
    source: megacityBrooklynBridgeNight,
    alt: 'The Brooklyn Bridge lit at night, the Lower Manhattan skyline and One World Trade Center glowing behind it and reflected in the river',
    district: 'megacity',
    title: 'Brooklyn Bridge at night',
    place: 'East River',
    width: 1200,
    height: 800,
    blurDataURL: 'data:image/webp;base64,UklGRpAAAABXRUJQVlA4IIQAAAAQBACdASoYABAAPtFWpEuoJKOhsAgBABoJYwDCgCHfZbL7p3WwG6rwcAD+6/EOK4O6I2jN5Vl5uLtkBFvM0k2irxIqn9RApSMjDiHfBISFqcMNKm0POJ1p8qt/jdxtsb3KsY9dgcwMGoswO94Dwok6h4AfCmPkOpY5CN/lmejEdAAo4AA=',
    credit: { author: 'Kai Pilger', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Brooklyn_Bridge_at_night.jpg' },
  },
  {
    id: 'megacity-bridge-deck',
    source: megacityBridgeDeck,
    alt: 'Night traffic and yellow cabs on the Brooklyn Bridge roadway beneath red steel trusses, with the lit Manhattan skyline beyond',
    district: 'megacity',
    title: 'Bridge deck',
    place: 'Brooklyn Bridge roadway',
    width: 1200,
    height: 800,
    blurDataURL: 'data:image/webp;base64,UklGRpQAAABXRUJQVlA4IIgAAACwAwCdASoYABAAPtFWo0uoJKMhsAgBABoJQBadBDs5VCH/Juc4HAD+9CBCGFHjST5moZYU/+4S/Cc4ZoUxG4uikyHJwjUubJpcMF0s7ux1StEw+CPMBviOaO5Gq1voq5qaQuA7ACQaQtsroUW14mXR8dDL6t/kJSwGolsgmxEFHN2YhEuRFgAA',
    credit: { author: 'Pierre Blach\u00e9', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Brooklyn_Bridge,_New_York.jpg' },
  },
];

export const photosIn = (district: PhotoDistrict) => NYC_PHOTOS.filter((p) => p.district === district);

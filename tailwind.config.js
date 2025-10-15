/** @type {import('tailwindcss').Config} */

export const content = ['./src/**/*.{js,jsx}'];
export const theme = {
  extend: {
    colors: {
      bluenova: '#5b6d92',
      kleinblue: '#002FA7',
      schenbrunnyellow: '#F7E14D',
      tiffanyblue: '#81D8D0',
      prusianblue: '#003153',
      lavendarblue: '#C6E7FF'
    },
    backgroundImage: {
     homebg: "url('/public/assets/images/home-landscape-image-1.png')"
    },
  },
};
export const plugins = [];



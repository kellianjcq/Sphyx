export const metadata = {
  title: 'Sphyx',
  description: 'Sphyx application',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

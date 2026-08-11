/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Crests come from football-data.org; event artwork from the ticket sites.
    remotePatterns: [
      { protocol: 'https', hostname: 'crests.football-data.org' },
      { protocol: 'https', hostname: 'media.stubhubstatic.com' },
      { protocol: 'https', hostname: '**.seatpick.com' },
      { protocol: 'https', hostname: '**.footballticketnet.com' },
      { protocol: 'https', hostname: '**.azureedge.net' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
    ],
  },
};

export default nextConfig;

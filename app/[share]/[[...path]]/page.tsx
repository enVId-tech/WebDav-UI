// app/[share]/[[[...path]]]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getDirectoryContents } from '@/lib/webdav-client';
import styles from '@/app/FileServer.module.scss';

export default function ShareSubPathFileBrowser() {
  const router = useRouter();
  const params = useParams();
  const [currentData, setCurrentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract share and path from URL params
  const share = params.share as string;
  const pathSegments = Array.isArray(params.path) ? params.path : [];
  const relativePath = `/${pathSegments.join('/')}`;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getDirectoryContents(relativePath, `/${share}`);
        setCurrentData(data);
        setError(null);
      } catch (err) {
        setError('Failed to load directory contents');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [share, relativePath]);

  // Rest of the component (same as in the root share page)
  // ...
}
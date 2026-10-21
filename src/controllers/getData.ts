import api from "@/apis/api";
import { useEffect, useState } from "react";

interface fetchDataProps {
  url: string;
}

function fetchAPI({ url }: fetchDataProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any[] | any>([]);
  const [error, setError] = useState<boolean>(false);
  const [refreshFlag, setRefreshFlag] = useState<boolean>(false);

  const refresh = () => setRefreshFlag((prev) => !prev);

  useEffect(() => {
    const getData = async () => {
      try {
        const response = await api.get(url);

        setData(response.data);
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    getData();
  }, [refreshFlag]);

  return { loading, data, error, refresh, setLoading, setData };
}

export default fetchAPI;

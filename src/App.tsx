
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://YOUR-SUPABASE-URL.supabase.co",
  "YOUR-ANON-KEY"
);

export default function App() {
  const [voters, setVoters] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchVoters();
  }, []);

  const fetchVoters = async () => {
    const { data, error } = await supabase
      .from("addoussieh_list_of_voters")
      .select("id, full_name, gender, family, register, situation, residence")
      .order("id", { ascending: true });

    if (error) console.error("Error fetching voters:", error);
    else setVoters(data);
  };

  const filteredVoters = voters.filter((v) =>
    [v.full_name, v.family, v.residence].some((field) =>
      field?.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold mb-4 text-center text-gray-800">
          Addoussieh Voter List
        </h1>
        <input
          type="text"
          placeholder="Search by name, family, or residence..."
          className="mb-4 p-2 border border-gray-300 rounded w-full"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="overflow-auto rounded shadow bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold">ID</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Full Name</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Gender</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Family</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Register</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Situation</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Residence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVoters.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-2 text-sm">{v.id}</td>
                  <td className="px-4 py-2 text-sm">{v.full_name}</td>
                  <td className="px-4 py-2 text-sm">{v.gender}</td>
                  <td className="px-4 py-2 text-sm">{v.family}</td>
                  <td className="px-4 py-2 text-sm">{v.register}</td>
                  <td className="px-4 py-2 text-sm">{v.situation}</td>
                  <td className="px-4 py-2 text-sm">{v.residence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

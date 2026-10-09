"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import BottomNav from "@/components/layout/BottomNav";
import TopBar from "@/components/layout/TopBar";
import VaultList from "@/components/vault/VaultList";
import Loader from "@/components/ui/Loader";
import Empty from "@/components/ui/Empty";
import { getVaultFolders, getVaultDocuments, createVaultFolder } from "@/lib/firestore";
import type { VaultFolder, VaultDocument } from "@/types";
import { FolderPlus } from "lucide-react";

export default function VaultPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && (!user || !profile)) {
      router.replace("/login");
    }
  }, [user, profile, loading, router]);

  const fetchData = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const [f, d] = await Promise.all([
        getVaultFolders(user.uid),
        getVaultDocuments(user.uid)
      ]);
      setFolders(f);
      setDocuments(d);
    } catch (error) {
      console.error("Failed to fetch vault data:", error);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const handleCreateFolder = async () => {
    if (!user) return;
    const name = prompt("Enter folder name (e.g. Unit 1, Midterms):");
    if (!name) return;
    try {
      await createVaultFolder({ userId: user.uid, name, createdAt: Date.now() });
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Failed to create folder");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Study Vault" />
        <main className="p-4 md:p-6 pb-24 lg:pb-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Your Vault Folders</h2>
              <p className="text-sm text-gray-400">
                Organize your study material into folders. Upload Textbooks and Past Papers together.
              </p>
            </div>
            <button
              onClick={handleCreateFolder}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </button>
          </div>

          <div>
            {loadingData ? (
              <Loader text="Loading vaults..." />
            ) : folders.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
                <p className="text-gray-400 mb-4">No folders yet.</p>
                <button
                  onClick={handleCreateFolder}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  Create your first Folder
                </button>
              </div>
            ) : (
              <VaultList folders={folders} documents={documents} onRefresh={fetchData} />
            )}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

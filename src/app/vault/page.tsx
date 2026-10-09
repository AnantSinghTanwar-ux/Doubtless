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
import Button from "@/components/ui/Button";
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
    <div className="min-h-screen bg-transparent">
      <Sidebar />
      <div className="lg:ml-64">
        <TopBar title="Study Vault" />
        <main id="main" className="mx-auto max-w-6xl p-4 pb-24 md:p-6 md:pb-24 lg:pb-8 [&>*]:max-w-4xl">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="display mb-2 text-2xl text-ink">Your study material</h2>
              <p className="max-w-xl text-muted">Keep textbooks and past papers in folders. Pick a file and every answer you ask for will cite it.</p>
            </div>
            <Button onClick={handleCreateFolder} variant="accent">
              <FolderPlus className="h-4 w-4" aria-hidden />
              New folder
            </Button>
          </div>

          <div>
            {loadingData ? (
              <Loader text="Loading your folders..." />
            ) : folders.length === 0 ? (
              <Empty
                icon={<FolderPlus />}
                title="No folders yet"
                description="Create a folder for a subject, then upload your textbooks and past papers into it."
                action={<Button onClick={handleCreateFolder}>Create your first folder</Button>}
              />
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

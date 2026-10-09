"use client";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { BadgeCheck } from "lucide-react";
import type { TeacherMatch, TeacherProfile } from "@/types";

interface TeacherCardProps {
  match?: TeacherMatch;
  teacher?: TeacherProfile;
  onRequestSession: (teacherId: string) => void;
  loading: boolean;
}

export default function TeacherCard({ match, teacher: rawTeacher, onRequestSession, loading }: TeacherCardProps) {
  const teacher = match?.teacher || rawTeacher;
  if (!teacher) return null;

  return (
    <Card className="bg-[#fffdf8]/80 hover:bg-[#fffdf8] transition-colors border-white/[0.06]">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-none flex flex-col items-center gap-3">
          {teacher.photoURL ? (
            <img src={teacher.photoURL} alt={teacher.name} className="w-20 h-20 rounded-2xl object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-3xl font-bold text-snow shadow-lg shadow-amber-500/20">
              {teacher.name.charAt(0)}
            </div>
          )}
          <div className="flex items-center gap-1 text-amber-400 font-medium">
            <span>⭐</span> {teacher.ratingCount === 0 ? "New" : teacher.rating.toFixed(1)}
          </div>
        </div>

        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-lg font-semibold text-white">
                {teacher.name}
                {teacher.verified ? (
                  <BadgeCheck className="h-5 w-5 fill-blue-500 text-[#fffdf8]" aria-label="Verified teacher" />
                ) : (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-200">Unverified</span>
                )}
              </h3>
              {teacher.headline && <p className="text-sm text-gray-300">{teacher.headline}</p>}
              <p className="text-sm text-gray-400">{teacher.subjects.join(" · ")}</p>
            </div>
            {match && (
              <Badge variant="success" className="hidden md:inline-flex">
                {match.score}% Match
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {teacher.specialties.map(spec => (
              <Badge key={spec} variant="default" className="text-xs bg-[#fffdf8]/75">
                {spec}
              </Badge>
            ))}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-white/[0.06]">
            <div className="flex-1 text-sm">
              {match ? (
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-400">💡</span>
                  <span className="text-gray-300">{match.explanation}</span>
                </div>
              ) : (
                <span className="text-gray-400">{teacher.doubtsResolved} doubts resolved</span>
              )}
            </div>
            
            <Button 
              onClick={() => onRequestSession(teacher.id)} 
              disabled={!teacher.availability || loading}
              loading={loading}
              className="w-full md:w-auto"
            >
              {teacher.availability ? "Request Session" : "Currently Busy"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

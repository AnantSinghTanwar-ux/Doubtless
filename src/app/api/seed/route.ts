import { NextResponse } from "next/server";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TeacherProfile } from "@/types";

const seedTeachers: Omit<TeacherProfile, "id">[] = [
  {
    uid: "teacher-1",
    name: "Dr. Priya Sharma",
    email: "priya@doubtless.ai",
    photoURL: null,
    subjects: ["Mathematics", "Calculus", "Linear Algebra"],
    rating: 4.8,
    availability: true,
    doubtsResolved: 156,
    specialties: ["Integration", "Differential Equations", "Matrix Theory"],
  },
  {
    uid: "teacher-2",
    name: "Prof. Arjun Mehta",
    email: "arjun@doubtless.ai",
    photoURL: null,
    subjects: ["Physics", "Mechanics", "Electromagnetism"],
    rating: 4.6,
    availability: true,
    doubtsResolved: 132,
    specialties: ["Newton's Laws", "Circuit Analysis", "Wave Optics"],
  },
  {
    uid: "teacher-3",
    name: "Dr. Sarah Chen",
    email: "sarah@doubtless.ai",
    photoURL: null,
    subjects: ["Chemistry", "Organic Chemistry", "Physical Chemistry"],
    rating: 4.9,
    availability: true,
    doubtsResolved: 189,
    specialties: ["Reaction Mechanisms", "Thermodynamics", "Spectroscopy"],
  },
  {
    uid: "teacher-4",
    name: "Prof. Rahul Verma",
    email: "rahul@doubtless.ai",
    photoURL: null,
    subjects: ["Computer Science", "Data Structures", "Algorithms"],
    rating: 4.7,
    availability: false,
    doubtsResolved: 98,
    specialties: ["Dynamic Programming", "Graph Theory", "System Design"],
  },
  {
    uid: "teacher-5",
    name: "Dr. Anjali Gupta",
    email: "anjali@doubtless.ai",
    photoURL: null,
    subjects: ["Biology", "Genetics", "Molecular Biology"],
    rating: 4.5,
    availability: true,
    doubtsResolved: 74,
    specialties: ["DNA Replication", "Cell Biology", "Evolution"],
  },
  {
    uid: "teacher-6",
    name: "Prof. Kiran Desai",
    email: "kiran@doubtless.ai",
    photoURL: null,
    subjects: ["Mathematics", "Statistics", "Probability"],
    rating: 4.4,
    availability: true,
    doubtsResolved: 112,
    specialties: ["Hypothesis Testing", "Regression", "Bayesian Methods"],
  },
];

export async function POST() {
  try {
    const promises = seedTeachers.map((teacher, index) => {
      const id = `seed-teacher-${index + 1}`;
      return setDoc(doc(db, "teachers", id), { ...teacher });
    });

    await Promise.all(promises);

    return NextResponse.json({
      message: `Seeded ${seedTeachers.length} teachers successfully`,
      teachers: seedTeachers.map((t) => t.name),
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seeding failed" },
      { status: 500 }
    );
  }
}

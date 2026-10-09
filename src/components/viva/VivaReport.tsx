"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getScoreColor } from "@/lib/utils";
import type { VivaReport } from "@/types";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface VivaReportProps {
  report: VivaReport;
}

export default function VivaReportDisplay({ report }: VivaReportProps) {
  
  const chartData = report.confidence_trend.map((conf, index) => ({
    question: `Q${index + 1}`,
    confidence: conf,
    score: report.answers[index]?.score || 0
  }));

  return (
    <div className="space-y-6">
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 bg-[#fffdf8]/80 text-center flex flex-col justify-center items-center py-10">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Overall Score</div>
          <div className={`text-6xl font-bold ${getScoreColor(report.overall_score)} mb-2`}>
            {report.overall_score.toFixed(1)}<span className="text-2xl font-normal text-gray-500">/10</span>
          </div>
          <p className="text-sm text-gray-400">Oral Examination Performance</p>
        </Card>

        <Card className="md:col-span-2 bg-[#fffdf8]/80">
          <CardTitle className="text-sm mb-4 text-blue-400 flex items-center gap-2">
            <span>📈</span> Performance & Confidence Trend
          </CardTitle>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                <XAxis dataKey="question" stroke="rgba(255,255,255,0.2)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} domain={[0, 10]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#f7f4ec', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="monotone" name="Confidence" dataKey="confidence" stroke="#c2410c" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" name="Score" dataKey="score" stroke="#c2410c" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-red-500/5 border-red-500/20">
          <CardTitle className="text-sm mb-4 text-red-400 flex items-center gap-2">
            <span>🎯</span> Weak Topics Identified
          </CardTitle>
          <ul className="space-y-2">
            {report.weak_topics.map((topic, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span> {topic}
              </li>
            ))}
            {report.weak_topics.length === 0 && (
               <li className="text-sm text-emerald-400">No specific weak topics identified. Great job!</li>
            )}
          </ul>
        </Card>

        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardTitle className="text-sm mb-4 text-emerald-400 flex items-center gap-2">
            <span>📋</span> Recommended Study Plan
          </CardTitle>
          <ul className="space-y-3">
            {report.study_plan.map((plan, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-emerald-400 mt-0.5">{i + 1}.</span> {plan}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="bg-[#fffdf8]/80 p-0 overflow-hidden border-white/[0.06]">
        <div className="p-4 border-b border-white/[0.06] bg-[#fffdf8]/55">
          <h3 className="font-semibold text-white">Detailed Q&A Breakdown</h3>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {report.answers.map((ans, idx) => (
            <div key={idx} className="p-5">
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-sm font-medium text-blue-300 flex-1 pr-4">Q{idx + 1}: {ans.question}</h4>
                <Badge variant={ans.score >= 7 ? "success" : ans.score >= 5 ? "warning" : "error"}>
                  {ans.score}/10
                </Badge>
              </div>
              <div className="bg-white/[0.05] p-3 rounded-lg border border-white/[0.03] mb-3">
                <p className="text-sm text-gray-300 italic">"{ans.answer}"</p>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed"><span className="font-medium text-emerald-400/80">Feedback:</span> {ans.feedback}</p>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}

"use client";

import Card, { CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Activity, ClipboardList, Target } from "lucide-react";
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
        <Card className="flex flex-col items-center justify-center py-10 text-center md:col-span-1">
          <div className="mb-2 text-sm font-medium text-muted">Overall score</div>
          <div className={`display tabular text-6xl ${getScoreColor(report.overall_score)} mb-2`}>
            {report.overall_score.toFixed(1)}<span className="text-2xl font-normal text-faint">/10</span>
          </div>
          <p className="text-sm text-muted">Oral exam performance</p>
        </Card>

        <Card className="md:col-span-2">
          <CardTitle className="mb-4 flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-pen" aria-hidden /> Score and confidence by question
          </CardTitle>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                <XAxis dataKey="question" stroke="rgba(20,33,61,0.3)" fontSize={12} />
                <YAxis stroke="rgba(20,33,61,0.3)" fontSize={12} domain={[0, 10]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#fffdf8', borderColor: '#e3dac7', borderRadius: '8px' }}
                  itemStyle={{ color: '#14213d' }}
                />
                <Line type="monotone" name="Confidence" dataKey="confidence" stroke="#c2410c" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" name="Score" dataKey="score" stroke="#14213d" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-margin" aria-hidden /> Topics to work on
          </CardTitle>
          <ul className="space-y-2">
            {report.weak_topics.map((topic, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-ink/85">
                <span className="h-1.5 w-1.5 rounded-full bg-margin" aria-hidden /> {topic}
              </li>
            ))}
            {report.weak_topics.length === 0 && (
               <li className="text-sm text-emerald-700">No weak topics found. Great job.</li>
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle className="mb-4 flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4 text-pen" aria-hidden /> Your study plan
          </CardTitle>
          <ul className="space-y-3">
            {report.study_plan.map((plan, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink/85">
                <span className="tabular mt-0.5 font-medium text-pen">{i + 1}.</span> {plan}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="border-b border-line bg-sunk p-4">
          <h3 className="font-display text-lg font-semibold text-ink">Question by question</h3>
        </div>
        <div className="divide-y divide-line">
          {report.answers.map((ans, idx) => (
            <div key={idx} className="p-5">
              <div className="flex justify-between items-start mb-3">
                <h4 className="flex-1 pr-4 text-sm font-medium text-ink">Q{idx + 1}. {ans.question}</h4>
                <Badge variant={ans.score >= 7 ? "success" : ans.score >= 5 ? "warning" : "error"}>
                  {ans.score}/10
                </Badge>
              </div>
              <div className="mb-3 rounded-lg border border-line bg-paper p-3">
                <p className="text-sm italic text-ink/80">&ldquo;{ans.answer}&rdquo;</p>
              </div>
              <p className="text-sm text-muted leading-relaxed"><span className="font-medium text-ink">Feedback:</span> {ans.feedback}</p>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}

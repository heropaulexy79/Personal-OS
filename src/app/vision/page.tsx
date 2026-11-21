"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Compass, Plus, Save, Sparkles, Trash2, X } from "lucide-react";
import { useOS } from "@/context/OSContext";
import { uid } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Textarea,
} from "@/components/ui/primitives";

const AREA_COLORS = [
  "#635BFF",
  "#0EA5E9",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#22C55E",
  "#EC4899",
  "#14B8A6",
  "#64748B",
];

export default function VisionPage() {
  const { data, updateVision, showToast } = useOS();
  const { vision } = data;

  const [northStar, setNorthStar] = useState(vision.northStar);
  const [statement, setStatement] = useState(vision.statement);
  const [horizonYears, setHorizonYears] = useState(vision.horizonYears);
  const [newValue, setNewValue] = useState("");

  useEffect(() => {
    setNorthStar(vision.northStar);
    setStatement(vision.statement);
    setHorizonYears(vision.horizonYears);
  }, [vision.id, vision.updatedAt, vision.northStar, vision.statement, vision.horizonYears]);

  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [areaDesc, setAreaDesc] = useState("");
  const [areaColor, setAreaColor] = useState(AREA_COLORS[0]);

  const handleSaveVision = () => {
    updateVision({
      northStar: northStar.trim(),
      statement: statement.trim(),
      horizonYears: Number(horizonYears) || 5,
    });
    showToast("Life Vision saved", "success");
  };

  const handleAddValue = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newValue.trim();
    if (!trimmed || vision.coreValues.includes(trimmed)) return;
    updateVision({ coreValues: [...vision.coreValues, trimmed] });
    setNewValue("");
  };

  const handleRemoveValue = (val: string) => {
    updateVision({ coreValues: vision.coreValues.filter((v) => v !== val) });
  };

  const handleCreateArea = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaName.trim()) return;
    updateVision({
      lifeAreas: [
        ...vision.lifeAreas,
        {
          id: uid("area"),
          name: areaName.trim(),
          description: areaDesc.trim(),
          color: areaColor,
        },
      ],
    });
    setAreaName("");
    setAreaDesc("");
    setAreaModalOpen(false);
    showToast("Life area added", "success");
  };

  const handleDeleteArea = (id: string) => {
    updateVision({
      lifeAreas: vision.lifeAreas.filter((a) => a.id !== id),
    });
    showToast("Life area removed");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--accent)]">
            Long-Term Direction
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">
            My Vision
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Define the person you are becoming and the life your daily actions should serve.
          </p>
        </div>
        <Button onClick={handleSaveVision}>
          <Save className="h-4 w-4" />
          Save Vision
        </Button>
      </div>

      {/* North Star & Vision Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-8 p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              North Star Statement ({horizonYears}-Year Horizon)
            </label>
            <Input
              value={northStar}
              onChange={(e) => setNorthStar(e.target.value)}
              placeholder="One clear sentence describing the life and impact you are building..."
              className="h-11 text-base font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
              Life Vision Narrative
            </label>
            <Textarea
              rows={8}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Describe the person you aspire to become, the standards you live by, and how your days feel when you are aligned..."
              className="leading-relaxed text-sm"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--text-secondary)]">Time Horizon (years)</label>
              <Input
                type="number"
                min={1}
                max={25}
                value={horizonYears}
                onChange={(e) => setHorizonYears(Number(e.target.value) || 5)}
                className="w-20 h-8"
              />
            </div>
            <Button size="sm" onClick={handleSaveVision}>
              Save Changes
            </Button>
          </div>
        </Card>

        {/* Core Values & Philosophy */}
        <div className="lg:col-span-4 space-y-5">
          <Card className="p-5">
            <CardTitle>Core Values</CardTitle>
            <CardDescription>Principles that govern your decisions</CardDescription>
            <div className="mt-4 flex flex-wrap gap-2">
              {vision.coreValues.map((val) => (
                <span
                  key={val}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1 text-xs font-medium"
                >
                  {val}
                  <button
                    onClick={() => handleRemoveValue(val)}
                    className="text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddValue} className="mt-4 flex gap-2">
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Add a core value..."
                className="h-8 text-xs"
              />
              <Button type="submit" size="sm" variant="secondary">
                Add
              </Button>
            </form>
          </Card>

          <Card className="p-5 bg-[var(--accent-soft)]/35 border-[var(--accent)]/20">
            <div className="flex items-center gap-2 text-[var(--accent)] mb-2">
              <Compass className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Guiding Philosophy
              </span>
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)] leading-relaxed">
              &ldquo;Your daily activities should be an expression of your long-term vision, not a
              distraction from it.&rdquo;
            </p>
            <Link
              href="/goals"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Translate vision into Goals →
            </Link>
          </Card>
        </div>
      </div>

      {/* Life Areas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Life Areas</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Organize your goals, habits, and analytics across the domains that matter most.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAreaModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Life Area
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vision.lifeAreas.map((area) => {
            const goalsCount = data.goals.filter(
              (g) => g.category === area.name && g.status === "active"
            ).length;
            const tasksCount = data.tasks.filter(
              (t) => t.category === area.name && t.status !== "done"
            ).length;
            return (
              <Card key={area.id} className="p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: area.color }}
                      />
                      <h3 className="text-sm font-semibold">{area.name}</h3>
                    </div>
                    <button
                      onClick={() => handleDeleteArea(area.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--danger)] p-1 cursor-pointer"
                      title="Remove life area"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                    {area.description || "Custom life domain"}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-2">
                  <Badge tone="neutral">{goalsCount} active goals</Badge>
                  <Badge tone="neutral">{tasksCount} open tasks</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Add Life Area Modal */}
      <Modal
        open={areaModalOpen}
        onClose={() => setAreaModalOpen(false)}
        title="Add Custom Life Area"
        description="Create a category to group goals, habits, and focus time."
      >
        <form onSubmit={handleCreateArea} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Area Name
            </label>
            <Input
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder="e.g. Creative Craft, Ministry, Family"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Description
            </label>
            <Input
              value={areaDesc}
              onChange={(e) => setAreaDesc(e.target.value)}
              placeholder="What does thriving look like in this area?"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">
              Accent Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {AREA_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAreaColor(c)}
                  className={`h-7 w-7 rounded-full cursor-pointer transition-transform ${
                    areaColor === c ? "scale-110 ring-2 ring-offset-2 ring-[var(--accent)]" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAreaModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Life Area</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


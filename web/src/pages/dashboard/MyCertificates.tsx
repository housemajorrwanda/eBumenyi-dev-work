import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  Download,
  BookOpen,
  Loader2,
  AlertCircle,
  ExternalLink,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { getMyCertificates, regenerateMyCertificate, IMyCertificate } from "@/services/certificates.service";

const MyCertificates: React.FC = () => {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState<IMyCertificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setCertificates(await getMyCertificates());
    } catch {
      setError("Failed to load certificates. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRegenerate = useCallback(async (cert: IMyCertificate) => {
    setRegeneratingId(cert.courseId);
    try {
      const updated = await regenerateMyCertificate(cert.courseId);
      setCertificates((prev) =>
        prev.map((c) => (c.courseId === cert.courseId ? { ...c, pdf: updated.pdf } : c))
      );
    } catch {
      // silently ignore — user can retry
    } finally {
      setRegeneratingId(null);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const avgScore =
    certificates.length > 0
      ? Math.round(
          certificates.reduce((sum, c) => sum + (c.finalExamMarks ?? 0), 0) /
            certificates.length
        )
      : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="animate-spin text-[#3363AD]" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-3">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-sm text-red-500">{error}</p>
        <Button size="sm" onClick={load}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Certificates</h1>
        <p className="text-sm text-gray-500 mt-1">
          Certificates you have earned by completing courses.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card padding={false} className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3363AD]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Award className="text-[#3363AD]" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Earned</p>
              <p className="text-xl font-bold text-gray-900">{certificates.length}</p>
            </div>
          </div>
        </Card>
        <Card padding={false} className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <GraduationCap className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-500">Avg. Exam Score</p>
              <p className="text-xl font-bold text-gray-900">
                {certificates.length > 0 ? `${avgScore}%` : "—"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Empty state */}
      {certificates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Award size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No certificates yet</p>
          <p className="text-xs mt-1">
            Complete a course's final exam to earn your first certificate.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => navigate("/my-learning")}
          >
            Go to My Learning
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {certificates.map((cert) => (
            <Card key={cert.id} padding={false} hover className="flex flex-col">
              {/* Cover */}
              <div className="relative h-36 bg-gradient-to-br from-[#3363AD] to-[#1a3d7c] rounded-t-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                {cert.image ? (
                  <img
                    src={cert.image}
                    alt={cert.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <BookOpen className="text-white opacity-50" size={40} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute bottom-2 left-3 flex items-center gap-1 text-white text-xs font-medium">
                  <Award size={12} />
                  Certificate
                </div>
              </div>

              {/* Body */}
              <div className="p-4 flex flex-col flex-1 gap-3">
                <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
                  {cert.title}
                </h3>

                <div className="space-y-1 text-xs text-gray-500">
                  {cert.completedAt && (
                    <p>Completed: <span className="text-gray-700">{cert.completedAt}</span></p>
                  )}
                  {cert.finalExamMarks != null && (
                    <p>
                      Final Exam Score:{" "}
                      <span className="text-[#3363AD] font-semibold">{cert.finalExamMarks}%</span>
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-auto flex gap-2">
                  {cert.pdf ? (
                    <>
                      <a
                        href={cert.pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#3363AD] text-white rounded-lg text-xs font-medium hover:bg-[#2a52a0] transition-colors"
                      >
                        <ExternalLink size={13} />
                        View PDF
                      </a>
                      <a
                        href={cert.pdf}
                        download
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                      >
                        <Download size={13} />
                      </a>
                    </>
                  ) : (
                    <span className="text-xs text-gray-400 italic">PDF not available</span>
                  )}
                  <button
                    onClick={() => handleRegenerate(cert)}
                    disabled={regeneratingId === cert.courseId}
                    title="Regenerate certificate"
                    className="flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {regeneratingId === cert.courseId ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyCertificates;

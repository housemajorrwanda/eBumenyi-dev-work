import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, Award } from "lucide-react";
import { verifyCertificate, ICertificateVerification } from "@/services/certificates.service";

const VerifyCertificate = () => {
  const { code } = useParams<{ code: string }>();
  const [status, setStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [cert, setCert] = useState<ICertificateVerification | null>(null);

  useEffect(() => {
    if (!code) { setStatus("invalid"); return; }
    verifyCertificate(code)
      .then((data) => { setCert(data); setStatus("valid"); })
      .catch(() => setStatus("invalid"));
  }, [code]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3363AD]/10 via-white to-[#3363AD]/5 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#3363AD] rounded-lg flex items-center justify-center">
            <Award className="text-white" size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-500 leading-none">Certificate Verification</p>
            <p className="text-sm font-semibold text-gray-800 leading-tight">Akili CHW Platform</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {status === "loading" && (
            <div className="text-center text-gray-500">
              <Loader2 className="animate-spin mx-auto mb-3 text-[#3363AD]" size={40} />
              <p className="text-sm">Verifying certificate…</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-8 text-center">
              <XCircle className="mx-auto mb-4 text-red-400" size={56} />
              <h1 className="text-xl font-bold text-gray-800 mb-2">Certificate Not Found</h1>
              <p className="text-sm text-gray-500 mb-6">
                This certificate code is invalid or the certificate no longer exists.
              </p>
              <Link
                to="/auth/login"
                className="inline-block text-sm text-[#3363AD] hover:underline"
              >
                Return to login
              </Link>
            </div>
          )}

          {status === "valid" && cert && (
            <div className="bg-white rounded-2xl shadow-lg border border-green-100 overflow-hidden">
              {/* Top banner */}
              <div className="bg-[#3363AD] px-8 py-6 text-white text-center">
                <CheckCircle className="mx-auto mb-2 text-green-300" size={48} />
                <h1 className="text-xl font-bold">Certificate Verified</h1>
                <p className="text-sm text-blue-100 mt-1">This is an authentic certificate issued by Akili CHW</p>
              </div>

              {/* Details */}
              <div className="px-8 py-6 space-y-4">
                <Row label="Recipient" value={cert.recipientName} />
                <Row label="Course" value={cert.courseName} />
                <Row label="Issued on" value={formatDate(cert.issuedAt)} />
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Certificate Code</p>
                  <p className="text-xs font-mono text-gray-600 break-all">{cert.id}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t border-gray-100 px-8 py-4 text-center">
                <p className="text-xs text-gray-400">
                  Verified on {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold mb-0.5">{label}</p>
    <p className="text-base font-medium text-gray-800">{value}</p>
  </div>
);

export default VerifyCertificate;

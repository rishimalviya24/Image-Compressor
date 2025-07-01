import React, { useState, useCallback, useRef } from 'react';
import { Upload, Download, FileImage, Zap, Check, AlertCircle, Sparkles, TrendingDown, Clock } from 'lucide-react';

const API_BASE = 'https://image-compressor-2-khpp.onrender.com/api';

const ImageCompressor = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [recentCompressions, setRecentCompressions] = useState([]);
  const fileInputRef = useRef(null);

  // Drag and drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileSelect = (file) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG)');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setResult(null);
    
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const compressImage = async () => {
    if (!selectedFile) return;

    setProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.data);
        fetchRecentCompressions();
      } else {
        setError(data.error || 'Failed to compress image');
      }
    } catch (err) {
      setError('Network error. Please check if the server is running.');
    } finally {
      setProcessing(false);
    }
  };

  const fetchRecentCompressions = async () => {
    try {
      const response = await fetch(`${API_BASE}/recent`);
      const data = await response.json();
      if (data.success) {
        setRecentCompressions(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch recent compressions:', err);
    }
  };

  const downloadImage = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  React.useEffect(() => {
    fetchRecentCompressions();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">AI Image Compressor</h1>
              <p className="text-slate-300">Intelligent compression with region-aware quality preservation</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Upload Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Zone */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
              <div
                className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
                  dragActive 
                    ? 'border-blue-400 bg-blue-500/10 scale-105' 
                    : 'border-white/30 hover:border-white/50 hover:bg-white/5'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Drop your image here or click to browse
                    </h3>
                    <p className="text-slate-300">
                      Supports JPG, PNG • Max size: 10MB
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  <span className="text-red-300">{error}</span>
                </div>
              )}
            </div>

            {/* Preview and Results */}
            {(preview || result) && (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Original Image */}
                  {preview && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                        <FileImage className="w-5 h-5" />
                        <span>Original</span>
                      </h3>
                      <div className="relative group">
                        <img
                          src={preview}
                          alt="Original"
                          className="w-full h-64 object-cover rounded-xl border border-white/20"
                        />
                        {selectedFile && (
                          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-lg">
                            <span className="text-xs text-white">
                              {formatFileSize(selectedFile.size)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Compressed Image */}
                  {result && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                        <Zap className="w-5 h-5 text-green-400" />
                        <span>Compressed</span>
                      </h3>
                      <div className="relative group">
                        <img
                          src={result.compressedUrl}
                          alt="Compressed"
                          className="w-full h-64 object-cover rounded-xl border border-white/20"
                        />
                        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-lg">
                          <span className="text-xs text-white">
                            {formatFileSize(result.compressedSize)}
                          </span>
                        </div>
                        <div className="absolute top-2 right-2 bg-green-500/90 backdrop-blur-sm px-2 py-1 rounded-lg">
                          <span className="text-xs text-white font-medium">
                            -{result.compressionRatio}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex flex-wrap gap-4">
                  {!result && selectedFile && (
                    <button
                      onClick={compressImage}
                      disabled={processing}
                      className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all ${
                        processing
                          ? 'bg-gray-600 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transform hover:scale-105'
                      } text-white`}
                    >
                      {processing ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          <span>Compress Image</span>
                        </>
                      )}
                    </button>
                  )}

                  {result && (
                    <button
                      onClick={() => downloadImage(result.compressedUrl, `compressed-${result.originalName}`)}
                      className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-all transform hover:scale-105"
                    >
                      <Download className="w-5 h-5" />
                      <span>Download</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            {result && (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <TrendingDown className="w-5 h-5 text-green-400" />
                  <span>Compression Stats</span>
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Original Size:</span>
                    <span className="text-white font-medium">{formatFileSize(result.originalSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Compressed Size:</span>
                    <span className="text-white font-medium">{formatFileSize(result.compressedSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Space Saved:</span>
                    <span className="text-green-400 font-bold">{result.compressionRatio}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-300">Quality Level:</span>
                    <span className="text-white font-medium">{result.quality}%</span>
                  </div>
                </div>

                {result.regions && result.regions.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-white mb-3">AI Detected Objects:</h4>
                    <div className="space-y-2">
                      {result.regions.slice(0, 3).map((region, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-slate-300 capitalize">
                            {region.label || 'Object'}
                          </span>
                          <span className="text-blue-400 font-medium">
                            {((region.score || 0) * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recent Compressions */}
            {recentCompressions.length > 0 && (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span>Recent Activity</span>
                </h3>
                <div className="space-y-3">
                  {recentCompressions.slice(0, 5).map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="text-white truncate">{item.originalName}</p>
                        <p className="text-slate-400 text-xs">
                          {formatFileSize(item.originalSize)} → {formatFileSize(item.compressedSize)}
                        </p>
                      </div>
                      <div className="ml-3 text-green-400 font-medium">
                        -{item.compressionRatio}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Features */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
              <h3 className="text-lg font-semibold text-white mb-4">Features</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300 text-sm">AI-powered region detection</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300 text-sm">Adaptive quality preservation</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300 text-sm">Real-time processing</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300 text-sm">Secure image handling</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCompressor;
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, Download, FileImage, Zap, Check, AlertCircle, 
  Sparkles, TrendingDown, Clock, Archive, Brain, Sliders,
  Move, X, Plus, Eye, EyeOff, ArrowRight, Loader2, 
  BarChart3, Settings, Image as ImageIcon, Wand2, Info,
  Star, Trash2, RefreshCw
} from 'lucide-react';

// const API_BASE = 'https://image-compressor-1-vgbf.onrender.com/api';
const API_BASE = 'https://image-compressor-1-nm7g.onrender.com/api';

const ImageCompressor = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [recentCompressions, setRecentCompressions] = useState([]);
  const [batchMode, setBatchMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRecommendation, setAiRecommendation] = useState(null);
  const [comparisonSlider, setComparisonSlider] = useState(50);
  const [selectedFormat, setSelectedFormat] = useState('webp');
  const [quality, setQuality] = useState(80);
  const [showComparison, setShowComparison] = useState(false);
  const [aiFormatRecommendation, setAiFormatRecommendation] = useState(null);
  const [gettingAiRecommendation, setGettingAiRecommendation] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [serverStatus, setServerStatus] = useState('checking');
  
  const fileInputRef = useRef(null);
  const sliderRef = useRef(null);

  // Predefined AI prompt suggestions
  const promptSuggestions = [
    "Optimize for email attachment",
    "High quality for print",
    "Social media sharing",
    "Web page optimization",
    "Mobile app use",
    "Professional portfolio",
    "E-commerce product images",
    "Blog post thumbnails"
  ];

  const formatOptions = [
    { value: 'webp', label: 'WebP (Recommended)', description: 'Best for web, smaller sizes', icon: '🌐' },
    { value: 'jpeg', label: 'JPEG', description: 'Universal compatibility', icon: '📷' },
    { value: 'png', label: 'PNG', description: 'Best for transparency', icon: '🖼️' },
    { value: 'avif', label: 'AVIF', description: 'Next-gen format', icon: '🚀' }
  ];

  // Check server health
  const checkServerHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      const data = await response.json();
      setServerStatus(data.status === 'OK' ? 'online' : 'offline');
    } catch (err) {
      setServerStatus('offline');
    }
  };

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
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, []);
// handleFileSelect updated for async race prevention
const handleFileSelect = (files) => {
  const validFiles = files.filter(file => {
    if (!file.type.startsWith('image/')) {
      setError('Please select valid image files (JPG, PNG, WebP)');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return false;
    }
    return true;
  });

  if (validFiles.length === 0) return;

  setSelectedFiles(validFiles);
  setBatchMode(validFiles.length > 1);
  setError(null);
  setResults([]);
  setShowComparison(false);
  setSelectedResultIndex(0);

  const promises = validFiles.map(file => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  });

  Promise.all(promises).then(setPreviews);
};


  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  // Get AI format recommendation
  const getAIFormatRecommendation = async (file) => {
    if (!file) return;
    
    setGettingAiRecommendation(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_BASE}/ai-format`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setAiFormatRecommendation(data.recommendation);
        setSelectedFormat(data.recommendation.format);
        return data.recommendation;
      }
    } catch (err) {
      console.error('AI format recommendation error:', err);
    } finally {
      setGettingAiRecommendation(false);
    }
    return null;
  };

  // Get AI quality recommendation
  const getAIQualityRecommendation = async (prompt) => {
    if (!prompt.trim()) return;
    
    setGettingAiRecommendation(true);
    try {
      const response = await fetch(`${API_BASE}/ai-quality`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();
      if (data.success) {
        setAiRecommendation(data.recommendation);
        setSelectedFormat(data.recommendation.format);
        setQuality(data.recommendation.quality);
      }
    } catch (err) {
      console.error('AI quality recommendation error:', err);
      setError('Failed to get AI recommendation');
    } finally {
      setGettingAiRecommendation(false);
    }
  };

  const compressImages = async () => {
    if (selectedFiles.length === 0) return;

    setProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      
      selectedFiles.forEach(file => {
        formData.append('images', file);
      });
      
      formData.append('format', selectedFormat);
      formData.append('quality', quality);
      if (aiPrompt) {
        formData.append('prompt', aiPrompt);
      }

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const resultArray = Array.isArray(data.data) ? data.data : [data.data];
        setResults(resultArray);
        setShowComparison(true);
        fetchRecentCompressions();
      } else {
        setError(data.error || 'Failed to compress images');
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

  const downloadBatch = async () => {
    if (results.length === 0) return;

    try {
      const imageIds = results.map(result => result.id);
      const response = await fetch(`${API_BASE}/download-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIds }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'compressed-images.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      setError('Failed to download batch');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setPreviews([]);
    setResults([]);
    setError(null);
    setAiPrompt('');
    setAiRecommendation(null);
    setAiFormatRecommendation(null);
    setShowComparison(false);
    setBatchMode(false);
    setSelectedResultIndex(0);
  };

  const handleSliderChange = (e) => {
    setComparisonSlider(e.target.value);
  };

  const getTotalSavings = () => {
    if (results.length === 0) return { originalSize: 0, compressedSize: 0, savings: 0 };
    
    const originalSize = results.reduce((sum, result) => sum + result.originalSize, 0);
    const compressedSize = results.reduce((sum, result) => sum + result.compressedSize, 0);
    const savings = ((originalSize - compressedSize) / originalSize * 100).toFixed(2);
    
    return { originalSize, compressedSize, savings };
  };

  // Auto-recommend format for first file
  useEffect(() => {
    if (selectedFiles.length > 0 && !aiPrompt) {
      getAIFormatRecommendation(selectedFiles[0]);
    }
  }, [selectedFiles]);

  useEffect(() => {
    checkServerHealth();
    fetchRecentCompressions();
    
    // Check server status periodically
    const interval = setInterval(checkServerHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const { originalSize, compressedSize, savings } = getTotalSavings();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">AI Image Compressor</h1>
                <p className="text-slate-300">Intelligent compression with AI-powered optimization</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Server Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  serverStatus === 'online' ? 'bg-green-400' : 
                  serverStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
                }`} />
                <span className="text-sm text-slate-300">
                  {serverStatus === 'online' ? 'Online' : 
                   serverStatus === 'offline' ? 'Offline' : 'Checking...'}
                </span>
              </div>
              {selectedFiles.length > 0 && (
                <button
                  onClick={clearAll}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-red-300 transition-all"
                >
                  <X className="w-4 h-4" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Zone */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/20">
              <div
                className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 cursor-pointer ${
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
                  multiple
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Drop your images here or click to browse
                    </h3>
                    <p className="text-slate-300">
                      Supports JPG, PNG, WebP • Max size: 10MB • Multiple files supported
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
            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">
                    Selected Files ({selectedFiles.length})
                  </h3>
                  <span className="text-sm text-slate-300">
                    {formatFileSize(selectedFiles.reduce((sum, file) => sum + file.size, 0))} total
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square bg-slate-800 rounded-lg overflow-hidden">
                        <img
                          src={preview}
                          alt={selectedFiles[index]?.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <button
                          onClick={() => {
                            const newFiles = selectedFiles.filter((_, i) => i !== index);
                            const newPreviews = previews.filter((_, i) => i !== index);
                            setSelectedFiles(newFiles);
                            setPreviews(newPreviews);
                            if (newFiles.length === 0) {
                              clearAll();
                            }
                          }}
                          className="p-2 bg-red-600 hover:bg-red-700 rounded-full text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-300 mt-2 truncate">
                        {selectedFiles[index]?.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* AI Prompt Section */}
            {selectedFiles.length > 0 && (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <div className="flex items-center space-x-3 mb-4">
                  <Brain className="w-6 h-6 text-purple-400" />
                  <h3 className="text-xl font-semibold text-white">AI Optimization</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Describe your use case (optional)
                    </label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g., 'Optimize for email attachment', 'High quality for print', etc."
                      className="w-full p-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-blue-400 focus:outline-none transition-colors"
                      rows="3"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {promptSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => setAiPrompt(suggestion)}
                        className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-full text-sm text-purple-200 transition-all"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                  {aiPrompt && (
                    <button
                      onClick={() => getAIQualityRecommendation(aiPrompt)}
                      disabled={gettingAiRecommendation}
                      className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white transition-all disabled:opacity-50"
                    >
                      {gettingAiRecommendation ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      <span>Get AI Recommendation</span>
                    </button>
                  )}
                </div>
              </div>
            )}
            {/* AI Recommendations Display */}
            {(aiRecommendation || aiFormatRecommendation) && (
              <div className="bg-gradient-to-r from-purple-600/10 to-blue-600/10 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30">
                <div className="flex items-center space-x-3 mb-4">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                  <h3 className="text-xl font-semibold text-white">AI Recommendations</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {aiFormatRecommendation && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <h4 className="font-semibold text-white mb-2">Format Suggestion</h4>
                      <p className="text-sm text-slate-300 mb-2">
                        <span className="font-medium text-purple-300">
                          {aiFormatRecommendation.format.toUpperCase()}
                        </span>
                        : {aiFormatRecommendation.reason}
                      </p>
                      {aiFormatRecommendation.detectedObjects && aiFormatRecommendation.detectedObjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {aiFormatRecommendation.detectedObjects.map((obj, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-600/20 text-blue-200 text-xs rounded">
                              {obj.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {aiRecommendation && (
                    <div className="bg-white/5 rounded-lg p-4">
                      <h4 className="font-semibold text-white mb-2">Quality Settings</h4>
                      <p className="text-sm text-slate-300 mb-2">
                        <span className="font-medium text-purple-300">
                          Quality: {aiRecommendation.quality}%
                        </span>
                      </p>
                      <p className="text-sm text-slate-300">
                        {aiRecommendation.context}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Compression Settings */}
            {selectedFiles.length > 0 && (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Settings className="w-6 h-6 text-blue-400" />
                    <h3 className="text-xl font-semibold text-white">Compression Settings</h3>
                  </div>
                  <button
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {showAdvancedSettings ? 'Hide' : 'Show'} Advanced
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Output Format
                    </label>
                    <div className="space-y-2">
                      {formatOptions.map((format) => (
                        <label key={format.value} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name="format"
                            value={format.value}
                            checked={selectedFormat === format.value}
                            onChange={(e) => setSelectedFormat(e.target.value)}
                            className="w-4 h-4 text-blue-600 bg-white/10 border-white/20 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{format.icon}</span>
                              <span className="text-white font-medium">{format.label}</span>
                            </div>
                            <p className="text-xs text-slate-400">{format.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Quality: {quality}%
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={quality}
                      onChange={(e) => setQuality(parseInt(e.target.value))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                      <span>Smaller</span>
                      <span>Higher Quality</span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={compressImages}
                    disabled={processing || serverStatus !== 'online'}
                    className="flex items-center space-x-3 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Compressing...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span>Compress {batchMode ? `${selectedFiles.length} Images` : 'Image'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
            {/* Results Section */}
            {results.length > 0 && (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <Check className="w-6 h-6 text-green-400" />
                    <h3 className="text-xl font-semibold text-white">
                      Compression Results
                    </h3>
                  </div>
                  {batchMode && (
                    <button
                      onClick={downloadBatch}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white transition-all"
                    >
                      <Archive className="w-4 h-4" />
                      <span>Download ZIP</span>
                    </button>
                  )}
                </div>
                {/* Overall Stats */}
                {results.length > 1 && (
                  <div className="bg-gradient-to-r from-green-600/10 to-blue-600/10 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-sm text-slate-300">Total Original</p>
                        <p className="text-lg font-semibold text-white">{formatFileSize(originalSize)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-300">Total Compressed</p>
                        <p className="text-lg font-semibold text-white">{formatFileSize(compressedSize)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-300">Total Savings</p>
                        <p className="text-lg font-semibold text-green-400">{savings}%</p>
                      </div>
                    </div>
                  </div>
                )}
                {/* Results Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`bg-white/5 rounded-lg p-4 border transition-all cursor-pointer ${
                        selectedResultIndex === index 
                          ? 'border-blue-400 bg-blue-500/10' 
                          : 'border-white/20 hover:border-white/40'
                      }`}
                      onClick={() => setSelectedResultIndex(index)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-medium truncate">{result.originalName}</span>
                        <span className="text-green-400 text-sm">
                          -{(((result.originalSize - result.compressedSize) / result.originalSize) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="aspect-square bg-slate-800 rounded-lg overflow-hidden mb-2">
                        <img
                          src={result.compressedUrl}
                          alt={result.originalName}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>
                          {formatFileSize(result.originalSize)} → {formatFileSize(result.compressedSize)}
                        </span>
                        <span>{result.format?.toUpperCase()}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadImage(result.compressedUrl, result.compressedName || result.originalName);
                        }}
                        className="mt-3 w-full flex items-center justify-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-all"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Stats Card */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
              <div className="flex items-center space-x-3 mb-4">
                <BarChart3 className="w-6 h-6 text-green-400" />
                <h3 className="text-xl font-semibold text-white">Statistics</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Files Processed</span>
                  <span className="text-white font-semibold">{results.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Total Saved</span>
                  <span className="text-green-400 font-semibold">
                    {results.length > 0 ? `${savings}%` : '0%'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Server Status</span>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      serverStatus === 'online' ? 'bg-green-400' : 
                      serverStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
                    }`} />
                    <span className="text-white text-sm">
                      {serverStatus === 'online' ? 'Online' : 
                       serverStatus === 'offline' ? 'Offline' : 'Checking...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {/* Recent Compressions */}
            <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Clock className="w-6 h-6 text-blue-400" />
                  <h3 className="text-xl font-semibold text-white">Recent</h3>
                </div>
                <button
                  onClick={fetchRecentCompressions}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <RefreshCw className="w-4 h-4 text-slate-300" />
                </button>
              </div>
              <div className="space-y-3">
                {recentCompressions.length > 0 ? (
                  recentCompressions.map((compression, index) => (
                    <div key={index} className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm font-medium truncate">
                          {compression.originalName}
                        </span>
                        <span className="text-green-400 text-sm">
                          -{compression.compressionRatio}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>{formatFileSize(compression.originalSize)} → {formatFileSize(compression.compressedSize)}</span>
                        <span>{compression.format?.toUpperCase()}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-400 py-8">
                    <FileImage className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No recent compressions</p>
                  </div>
                )}
              </div>
            </div>
            {/* Tips Card */}
            <div className="bg-gradient-to-br from-purple-600/10 to-blue-600/10 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30">
              <div className="flex items-center space-x-3 mb-4">
                <Info className="w-6 h-6 text-purple-400" />
                <h3 className="text-xl font-semibold text-white">Pro Tips</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start space-x-2">
                  <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-slate-300">Use WebP format for best web performance</p>
                </div>
                <div className="flex items-start space-x-2">
                  <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-slate-300">Higher quality settings preserve more detail</p>
                </div>
                <div className="flex items-start space-x-2">
                  <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-slate-300">AI recommendations optimize for your use case</p>
                </div>
                <div className="flex items-start space-x-2">
                  <Star className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-slate-300">Batch processing saves time with multiple files</p>
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
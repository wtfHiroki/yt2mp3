import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Music, 
  Plus, 
  Play, 
  Download, 
  X, 
  Clock, 
  CheckCircle, 
  Loader2,
  AlertCircle,
  Layers,
  Zap,
  Shield,
  RotateCcw,
  Clipboard
} from "lucide-react";
import type { Conversion } from "@shared/schema";

interface ConversionStats {
  total: number;
  today: number;
  successRate: string;
  avgSize: string;
}

export default function ConverterPage() {
  const [urls, setUrls] = useState<string[]>([""]);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  // Fetch conversions
  const { data: conversions = [], isLoading } = useQuery<Conversion[]>({
    queryKey: ["/api/conversions"],
    refetchInterval: 2000, // Poll for updates
  });

  // Create single conversion
  const createConversionMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/conversions", { url });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversions"] });
      toast({
        title: "Conversion Started",
        description: "Your video is being processed",
      });
    },
    onError: (error) => {
      toast({
        title: "Conversion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create bulk conversions
  const createBulkConversionMutation = useMutation({
    mutationFn: async (urls: string[]) => {
      const response = await apiRequest("POST", "/api/conversions/bulk", { urls });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversions"] });
      setUrls([""]);
      toast({
        title: "Conversions Started",
        description: `Processing ${urls.filter(Boolean).length} videos`,
      });
    },
    onError: (error) => {
      toast({
        title: "Conversion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete conversion
  const deleteConversionMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/conversions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversions"] });
      toast({
        title: "Conversion Deleted",
        description: "File removed successfully",
      });
    },
  });

  const addUrlField = useCallback(() => {
    setUrls(prev => [...prev, ""]);
  }, []);

  const removeUrlField = useCallback((index: number) => {
    setUrls(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateUrl = useCallback((index: number, value: string) => {
    setUrls(prev => prev.map((url, i) => i === index ? value : url));
  }, []);

  const clearAllUrls = useCallback(() => {
    setUrls([""]);
  }, []);

  const pasteFromClipboard = useCallback(async (index: number) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        updateUrl(index, text.trim());
        toast({
          title: "Pasted URL",
          description: "URL pasted from clipboard successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Paste Failed",
        description: "Unable to access clipboard. Please paste manually.",
        variant: "destructive",
      });
    }
  }, [updateUrl, toast]);

  const startConversion = useCallback(() => {
    const validUrls = urls.filter(url => url.trim());
    if (validUrls.length === 0) {
      toast({
        title: "No URLs",
        description: "Please add at least one YouTube URL",
        variant: "destructive",
      });
      return;
    }

    if (validUrls.length === 1) {
      createConversionMutation.mutate(validUrls[0]);
    } else {
      createBulkConversionMutation.mutate(validUrls);
    }
  }, [urls, createConversionMutation, createBulkConversionMutation, toast]);

  const downloadFile = useCallback((id: number) => {
    window.open(`/api/download/${id}`, "_blank");
  }, []);

  const downloadBulk = useCallback(async () => {
    const ids = Array.from(selectedFiles);
    if (ids.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please select files to download",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/download/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "converted_files.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download Started",
        description: "Your files are downloading as a ZIP archive",
      });
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download files",
        variant: "destructive",
      });
    }
  }, [selectedFiles, toast]);

  const toggleFileSelection = useCallback((id: number) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Calculate stats
  const stats: ConversionStats = {
    total: conversions.length,
    today: conversions.filter(c => {
      const today = new Date().toDateString();
      return c.createdAt && new Date(c.createdAt).toDateString() === today;
    }).length,
    successRate: conversions.length > 0 
      ? `${Math.round((conversions.filter(c => c.status === "completed").length / conversions.length) * 100)}%`
      : "0%",
    avgSize: conversions.filter(c => c.fileSize).length > 0
      ? `${Math.round(conversions.filter(c => c.fileSize).reduce((sum, c) => sum + (c.fileSize || 0), 0) / conversions.filter(c => c.fileSize).length / 1024 / 1024 * 10) / 10} MB`
      : "0 MB"
  };

  const completedConversions = conversions.filter(c => c.status === "completed");
  const recentDownloads = completedConversions.slice(0, 3);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "processing":
        return <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />;
      case "failed":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-50 border-green-200";
      case "processing":
        return "bg-amber-50 border-amber-200";
      case "failed":
        return "bg-red-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "0 MB";
    return `${Math.round(bytes / 1024 / 1024 * 10) / 10} MB`;
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <Music className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-gray-900">YT2MP3 Converter</h1>
            </div>
            <div className="hidden sm:flex items-center space-x-4">
              <span className="text-sm text-gray-500">Professional Audio Conversion</span>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-600 font-medium">Online</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-4">
            Convert YouTube Videos to MP3
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Fast, reliable, and professional audio conversion tool. 
            Convert multiple YouTube videos to high-quality MP3 files with ease.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* URL Input Section */}
          <div className="xl:col-span-2">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Add YouTube URLs</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllUrls}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    Clear All
                  </Button>
                </div>

                {/* URL Input Form */}
                <div className="space-y-4 mb-6">
                  {urls.map((url, index) => (
                    <div key={index} className="flex items-center space-x-3 group">
                      <div className="flex-1">
                        <Input
                          type="url"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={url}
                          onChange={(e) => updateUrl(index, e.target.value)}
                          className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => pasteFromClipboard(index)}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        title="Paste from clipboard"
                      >
                        <Clipboard className="h-4 w-4" />
                      </Button>
                      {urls.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeUrlField(index)}
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={addUrlField}
                    className="flex items-center justify-center text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add More URLs
                  </Button>
                  <Button
                    onClick={startConversion}
                    disabled={createConversionMutation.isPending || createBulkConversionMutation.isPending}
                    className="flex-1 sm:flex-none bg-blue-500 hover:bg-blue-600"
                  >
                    {(createConversionMutation.isPending || createBulkConversionMutation.isPending) ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Start Conversion
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Conversion Progress Section */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-6">Conversion Progress</h3>
                
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : conversions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No conversions yet. Add some YouTube URLs to get started!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conversions.map((conversion) => (
                      <div
                        key={conversion.id}
                        className={`flex items-center p-4 border rounded-lg ${getStatusColor(conversion.status)}`}
                      >
                        <div className="w-12 h-12 bg-white/50 rounded-lg flex items-center justify-center mr-4">
                          {getStatusIcon(conversion.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {conversion.title || "Loading video info..."}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {conversion.status === "completed" && `Converted successfully • ${formatFileSize(conversion.fileSize)}`}
                            {conversion.status === "processing" && `Converting audio... ${conversion.progress}%`}
                            {conversion.status === "failed" && `Failed: ${conversion.errorMessage}`}
                            {conversion.status === "pending" && "Waiting in queue..."}
                          </p>
                          {conversion.status === "processing" && (
                            <Progress value={conversion.progress || 0} className="mt-2" />
                          )}
                        </div>
                        <div className="ml-4">
                          {conversion.status === "completed" ? (
                            <Button
                              onClick={() => downloadFile(conversion.id)}
                              className="bg-green-500 hover:bg-green-600"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </Button>
                          ) : conversion.status === "processing" ? (
                            <div className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium">
                              Processing...
                            </div>
                          ) : conversion.status === "failed" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteConversionMutation.mutate(conversion.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : (
                            <div className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
                              Queued
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Information */}
          <div className="space-y-6">
            {/* Conversion Stats */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Stats</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Conversions</span>
                    <span className="font-semibold text-gray-900">{stats.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Completed Today</span>
                    <span className="font-semibold text-green-600">{stats.today}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Success Rate</span>
                    <span className="font-semibold text-blue-600">{stats.successRate}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Avg File Size</span>
                    <span className="font-semibold text-gray-900">{stats.avgSize}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Download History */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Downloads</h3>
                </div>
                <div className="space-y-3">
                  {recentDownloads.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No completed downloads yet
                    </div>
                  ) : (
                    recentDownloads.map((download) => (
                      <div key={download.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Music className="h-4 w-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 truncate">
                            {download.title}
                          </h4>
                          <p className="text-xs text-gray-500">
                            {download.completedAt && new Date(download.completedAt).toLocaleDateString()} • {formatFileSize(download.fileSize)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadFile(download.id)}
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Features & Info */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Features</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm text-gray-700">High-quality MP3 conversion</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Layers className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-700">Batch processing support</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Zap className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-sm text-gray-700">Fast conversion speed</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Shield className="h-4 w-4 text-orange-600" />
                    </div>
                    <span className="text-sm text-gray-700">Secure & private</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Bulk Download Section */}
        {completedConversions.length > 0 && (
          <Card className="mt-8">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Bulk Download</h3>
                  <p className="text-sm text-gray-500 mt-1">Download all completed conversions at once</p>
                </div>
                <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                  <span className="text-sm text-gray-600">
                    {selectedFiles.size} of {completedConversions.length} files selected
                  </span>
                  <Button
                    onClick={downloadBulk}
                    disabled={selectedFiles.size === 0}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Selected ({selectedFiles.size})
                  </Button>
                </div>
              </div>

              {/* File List for Bulk Download */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedConversions.map((file) => (
                  <div key={file.id} className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <Checkbox
                      checked={selectedFiles.has(file.id)}
                      onCheckedChange={() => toggleFileSelection(file.id)}
                      className="mr-3"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {file.title}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.fileSize)} • MP3
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => downloadFile(file.id)}
                      className="ml-2 text-gray-400 hover:text-blue-600"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

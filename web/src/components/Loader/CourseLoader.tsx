import { useState, useEffect } from 'react';
import InnovativeLoader from './InnovativeLoader';

interface CourseLoaderProps {
  operation: 'saving' | 'uploading' | 'processing' | 'loading';
  fileType?: 'video' | 'pdf' | 'image' | 'document';
  fileName?: string;
  stage?: string;
}

const CourseLoader = ({ 
  operation, 
  fileType,
  fileName,
  stage 
}: CourseLoaderProps) => {
  const [estimatedTime, setEstimatedTime] = useState(5);

  // Set estimated time based on operation and file type
  useEffect(() => {
    let time = 5;
    
    switch (operation) {
      case 'uploading':
        time = fileType === 'video' ? 15 : fileType === 'pdf' ? 8 : 5;
        break;
      case 'processing':
        time = fileType === 'video' ? 20 : 8;
        break;
      case 'saving':
        time = 7;
        break;
      case 'loading':
        time = 6;
        break;
    }
    
    setEstimatedTime(time);
  }, [operation, fileType]);

  const getOperationConfig = () => {
    switch (operation) {
      case 'saving':
        return {
          message: `Saving your course${fileName ? ` "${fileName}"` : ''}...`,
          tips: [
            "💾 Pro tip: Regular saves prevent data loss",
            "📝 Organizing content in chapters improves learning flow",
            "🎯 Clear learning objectives increase CHW engagement",
            "📊 Interactive elements boost retention by 85%",
            "🔄 Version control helps track course improvements",
            "🎨 Visual content increases comprehension by 400%",
            "⚡ Quick saves: Use Ctrl+S frequently while editing",
            "📋 Course templates can speed up creation process"
          ]
        };
      
      case 'uploading':
        return {
          message: `Uploading ${fileType || 'file'}${fileName ? ` "${fileName}"` : ''}...`,
          tips: [
            fileType === 'video' ? "🎬 Video content increases engagement by 200%" : "📁 Optimizing file sizes improves loading speed",
            fileType === 'pdf' ? "📄 PDFs are great for detailed reference materials" : "🔒 Secure file uploads protect your content",
            "☁️ Cloud storage ensures your files are always accessible",
            "📱 Mobile-optimized content reaches 70% more learners",
            "⚡ Compressed files load 3x faster for chw",
            "🌐 CDN delivery provides global access speeds",
            "🔄 Auto-backup prevents content loss during uploads",
            "📊 File analytics help optimize content delivery"
          ]
        };
      
      case 'processing':
        return {
          message: `Processing ${fileType || 'content'}${fileName ? ` "${fileName}"` : ''}...`,
          tips: [
            fileType === 'video' ? "🎥 Video processing optimizes for all devices" : "⚙️ Processing ensures optimal content delivery",
            "🔧 Auto-enhancement improves content quality",
            "📈 Processing analytics help optimize performance",
            "🎯 Smart compression maintains quality while reducing size",
            "🌟 AI processing can generate subtitles automatically",
            "📊 Quality metrics ensure best CHW experience",
            "⚡ Background processing doesn't interrupt your workflow",
            "🔄 Multi-format output supports all learning platforms"
          ]
        };
      
      case 'loading':
      default:
        return {
          message: `Loading course content...`,
          tips: [
            "📚 Structured courses improve completion rates by 60%",
            "🎯 Interactive quizzes boost knowledge retention",
            "💡 Micro-learning breaks increase focus and memory",
            "🌟 Gamification elements motivate continuous learning",
            "📱 Mobile accessibility increases study time by 40%",
            "🔄 Progress tracking helps maintain learning momentum",
            "👥 Community features enhance collaborative learning",
            "🏆 Achievement systems increase course completion rates"
          ]
        };
    }
  };

  const config = getOperationConfig();

  return (
    <InnovativeLoader
      message={config.message}
      tips={config.tips}
      estimatedTime={estimatedTime}
      stage={stage}
    />
  );
};

export default CourseLoader;

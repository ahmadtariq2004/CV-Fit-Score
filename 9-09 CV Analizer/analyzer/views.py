from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

from .serializers import CVAnalysisSerializer
from .services.cv_parser import CVParseError, extract_text
from .services.qwen_service import QwenServiceError, analyze


@method_decorator(csrf_exempt, name='dispatch')
class AnalyzeCVView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = CVAnalysisSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'error': 'Please provide a job description and a CV file.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            cv_text = extract_text(serializer.validated_data['cv_file'])
            result = analyze(serializer.validated_data['job_description'], cv_text)
        except CVParseError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except QwenServiceError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(result, status=status.HTTP_200_OK)

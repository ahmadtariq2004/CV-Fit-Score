from rest_framework import serializers


class CVAnalysisSerializer(serializers.Serializer):
    job_description = serializers.CharField(max_length=12000, allow_blank=False, trim_whitespace=True)
    cv_file = serializers.FileField()

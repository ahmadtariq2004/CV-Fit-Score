from django.urls import path
from .views import AnalyzeCVView

urlpatterns = [
    path('analyze-cv/', AnalyzeCVView.as_view(), name='analyze-cv'),
]
